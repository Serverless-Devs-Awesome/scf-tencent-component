const download = require('download')
const {Cos} = require('tencent-component-toolkit')
const {TypeError} = require('tencent-component-toolkit/src/utils/error')
const CONFIGS = require('./config')
const path = require('path')
const {packTo} = require('@serverless-devs/s-zip');
const fse = require('fs-extra')

/**
 * Generate random id
 */
const generateId = () =>
    Math.random()
        .toString(36)
        .substring(6)

const getType = (obj) => {
    return Object.prototype.toString.call(obj).slice(8, -1)
}

const validateTraffic = (num) => {
    if (getType(num) !== 'Number') {
        throw new TypeError(
            `PARAMETER_${CONFIGS.compName.toUpperCase()}_TRAFFIC`,
            'traffic must be a number'
        )
    }
    if (num < 0 || num > 1) {
        throw new TypeError(
            `PARAMETER_${CONFIGS.compName.toUpperCase()}_TRAFFIC`,
            'traffic must be a number between 0 and 1'
        )
    }
    return true
}

const getDefaultProtocol = (protocols) => {
    return String(protocols).includes('https') ? 'https' : 'http'
}

const getDefaultFunctionName = () => {
    return `ServerlessDevsFunction`
}

const getDefaultTriggerName = (type) => {
    return `${type}-serverless-trigger`
}

const getDefaultServiceName = () => {
    return 'serverless'
}

const getDefaultServiceDescription = () => {
    return `The service of serverless scf`
}

/**
 * get default template zip file path
 */
const getDefaultZipPath = async () => {
    console.log(`Packaging ${CONFIGS.compFullname} application...`)

    // unzip source zip file
    // add default template
    const downloadPath = `./.s/cache`
    const filename = 'template'

    console.log(`Installing Default ${CONFIGS.compFullname} App...`)
    try {
        await download(CONFIGS.templateUrl, downloadPath, {
            filename: `${filename}.zip`
        })
    } catch (e) {
        throw new TypeError(
            `DOWNLOAD_${CONFIGS.compName.toUpperCase()}_TEMPLATE`,
            'Download default template failed.'
        )
    }
    const zipPath = `${downloadPath}/${filename}.zip`

    return zipPath
}

/**
 * prepare scf deploy input parameters
 * @param {Component} instance serverless component
 * @param {object} credentials component credentials
 * @param {string} appId app id
 * @param {object} inputs yml inputs
 */
const prepareInputs = async (instance, credentials, appId, inputs) => {
    // 默认值
    const region = inputs.region || CONFIGS.region
    const tempSrc =
        typeof inputs.src === 'object'
            ? inputs.src
            : typeof inputs.src === 'string'
            ? {
                src: inputs.src
            }
            : {}

    const code = {
        bucket: tempSrc.bucket || `s-scf-${region}-code`,
        object:
            tempSrc.object ||
            `/Serverless-Devs-Tool-${generateId()}-${Math.floor(Date.now() / 1000)}.zip`
    }
    const cos = new Cos(credentials, region)
    const bucket = `${code.bucket}-${appId}`

    // create new bucket, and setup lifecycle for it
    if (!tempSrc.bucket) {
        await cos.deploy({
            bucket: bucket,
            force: true,
            lifecycle: [
                {
                    status: 'Enabled',
                    id: 'deleteObject',
                    filter: '',
                    expiration: {days: '10'},
                    abortIncompleteMultipartUpload: {daysAfterInitiation: '10'}
                }
            ]
        })
    }

    let useDefault
    if (!tempSrc.object) {
        // whether use default template, if so, download it
        // get default template code
        let zipPath
        const packToParame = {
            outputFilePath: './.s/cache/',
            outputFileName: `${inputs.functionName}.zip`
        };
        if (typeof code == 'string') {
            packToParame.codeUri = tempSrc;
        } else {
            packToParame.codeUri = tempSrc.src;
            packToParame.exclude = tempSrc.exclude;
            packToParame.include = tempSrc.include;
        }
        const codeUri = packToParame.codeUri;
        if (codeUri.endsWith('.s-zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war')) {
            const srcPath = path.resolve(codeUri);
            const destPath = path.resolve(cachePath, `${projectName}.zip`);
            if (srcPath !== destPath) {
                await fse.copy(srcPath, destPath);
            }
        } else {
            const test = await packTo(packToParame);
            if (!test.count) {
                throw new Error('Zip file error');
            }
        }
        zipPath = `./.s/cache/${inputs.functionName}.zip`
        console.log(`Uploading code ${code.object} to bucket ${bucket}`)
        await cos.upload({
            bucket: bucket,
            file: zipPath,
            key: code.object
        })
    }

    const oldState = instance.state
    inputs.name =
        inputs.name ||
        (oldState.function && oldState.function.FunctionName) || getDefaultFunctionName()
    inputs.runtime = inputs.runtime || CONFIGS.runtime
    inputs.handler = inputs.handler || CONFIGS.handler(inputs.runtime)
    inputs.description = inputs.description || CONFIGS.description()
    inputs.code = code
    inputs.events = inputs.events || []

    const stateApigw = oldState.apigw
    const triggers = {}
    const apigwName = []

    let existApigwTrigger = false
    // initial apigw event parameters
    inputs.events = inputs.events.map((event) => {
        const eventType = Object.keys(event)[0]
        // check trigger type
        if (CONFIGS.triggerTypes.indexOf(eventType) === -1) {
            throw new TypeError(
                `PARAMETER_${CONFIGS.compName.toUpperCase()}_APIGW_TRIGGER`,
                `Unknow trigger type ${eventType}, must be one of ${JSON.stringify(CONFIGS.triggerTypes)}`
            )
        }
        const currentEvent = event[eventType]
        triggers[eventType] = triggers[eventType] || []

        if (eventType === 'apigw') {
            if (apigwName.includes(currentEvent.name)) {
                throw new TypeError(
                    `PARAMETER_${CONFIGS.compName.toUpperCase()}_APIGW_TRIGGER`,
                    `API Gateway name must be unique`
                )
            } else {
                currentEvent.parameters.serviceName =
                    currentEvent.parameters.serviceName ||
                    currentEvent.name ||
                    getDefaultServiceName()
                currentEvent.parameters.description =
                    currentEvent.parameters.description || getDefaultServiceDescription()
                currentEvent.name = currentEvent.name || getDefaultTriggerName(eventType)
                if (stateApigw && stateApigw[currentEvent.parameters.serviceName]) {
                    currentEvent.parameters.serviceId =
                        currentEvent.parameters.serviceId || stateApigw[currentEvent.parameters.serviceName]
                }
                apigwName.push(currentEvent.parameters.serviceName)
            }
            existApigwTrigger = true
        } else {
            currentEvent.name = currentEvent.name || getDefaultTriggerName(eventType)
            triggers[eventType].push(currentEvent.name)
        }
        return event
    })

    // if not config apig trigger, and make autoCreateApi true
    if (inputs.autoCreateApi && !existApigwTrigger) {
        triggers.apigw = []
        const {defaultApigw} = CONFIGS
        defaultApigw.parameters.serviceName = getDefaultServiceName()
        defaultApigw.parameters.description = getDefaultServiceDescription(instance)
        inputs.events.push({
            apigw: defaultApigw
        })

        existApigwTrigger = true
    }

    // validate traffic config
    if (inputs.traffic !== undefined) {
        validateTraffic(inputs.traffic)
    }

    inputs.lastVersion = instance.state.lastVersion

    return {
        useDefault,
        existApigwTrigger,
        scfInputs: inputs,
        triggers
    }
}

module.exports = {
    getType,
    getDefaultProtocol,
    generateId,
    prepareInputs,
    getDefaultZipPath
}
