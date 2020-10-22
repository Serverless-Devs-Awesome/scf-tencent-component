const {Component} = require('@serverless-devs/s-core')
const {Scf} = require('tencent-component-toolkit')
const {TypeError} = require('tencent-component-toolkit/src/utils/error')
const {prepareInputs, getType, getDefaultProtocol} = require('./utils')
const CONFIGS = require('./config')

class SCFComponent extends Component {
    async getProperties(properties) {
        const tempProperties = {}
        if (typeof properties == "object") {
            for (const item in properties) {
                const tempItem = item.charAt(0).toLowerCase() + item.substring(1)
                if (typeof properties[item] == "object") {
                    if (properties[item] instanceof Array) {
                        const tempArray = []
                        for (let i = 0; i < properties[item].length; i++) {
                            tempArray.push(await this.getProperties(properties[item][i]))
                        }
                        tempProperties[tempItem] = tempArray
                    } else {
                        tempProperties[tempItem] = await this.getProperties(properties[item])
                    }
                } else {
                    tempProperties[tempItem] = properties[item]
                }
            }
            return tempProperties
        }
        return properties
    }

    async getApigwProperties(properties) {
        const tempProperties = {}
        if (typeof properties == "object") {
            for (const item in properties) {
                const tempItem = item.charAt(0).toLowerCase() + item.substring(1)
                if (typeof properties[item] == "object") {
                    if (properties[item] instanceof Array) {
                        const tempArray = []
                        for (let i = 0; i < properties[item].length; i++) {
                            tempArray.push(await this.getApigwProperties(properties[item][i]))
                        }
                        tempProperties[tempItem] = tempArray
                    } else {
                        tempProperties[tempItem] = await this.getApigwProperties(properties[item])
                    }
                } else {
                    tempProperties[tempItem] = properties[item]
                }
            }
            return tempProperties
        }
        return properties
    }

    async getApigwInputs(inputs) {
        const properties = {}
        if (inputs.Id) {
            properties.serviceId = inputs.Id
        }
        if (inputs.Name) {
            properties.serviceName = inputs.Name
        }
        if (inputs.Protocols) {
            properties.protocols = inputs.Protocols
        }
        if (inputs.Description) {
            properties.description = inputs.Description
        }
        if (inputs.Environment) {
            properties.environment = inputs.Environment
        }
        if (inputs.NetTypes) {
            properties.netTypes = inputs.NetTypes
        }
        if (inputs.Domains) {
            properties.customDomain = await this.getApigwProperties(inputs.Domains)
        }
        if (inputs.API) {
            properties.endpoints = []
            const tempAPI = inputs.API
            for (let i = 0; i < tempAPI.length; i++) {
                if (tempAPI[i].Parameters) {
                    const tempEveApi = tempAPI[i]
                    for (let k = 0; k < tempEveApi.Parameters.length; k++) {
                        if (tempEveApi.Parameters[k].Description) {
                            tempEveApi.Parameters[k].desc = JSON.parse(JSON.stringify(tempEveApi.Parameters[k].Description))
                            delete tempEveApi.Parameters[k].Description
                        }
                    }
                    tempAPI[i].param = JSON.parse(JSON.stringify(tempEveApi))
                    delete tempAPI[i].Parameters
                }
                properties.endpoints.push(await this.getApigwProperties(tempAPI[i]))
            }
        }
        return properties
    }

    async deploy(inputs) {

        console.log(`Deploying Tencent ${CONFIGS.compFullname}...`)

        const credentials = {
            AppId: inputs.Credentials.AccountID,
            SecretId: inputs.Credentials.SecretID,
            SecretKey: inputs.Credentials.SecretKey,
        }
        const appId = credentials.AppId

        // 默认值
        await this.init()

        const properties = {}
        properties.name = inputs.Properties.Function.Name
        properties.role = inputs.Properties.Function.Role

        if (inputs.Properties.Namespace && inputs.Properties.Namespace.Name) {
            properties.namespace = inputs.Properties.Namespace.Name
        }
        if (inputs.Properties.Function.Role) {
            properties.role = inputs.Properties.Function.Role
        }
        if (inputs.Properties.Function.Description) {
            properties.description = inputs.Properties.Function.Description
        }
        if (inputs.Properties.Function.Handler) {
            properties.handler = inputs.Properties.Function.Handler
        }
        if (inputs.Properties.Function.Runtime) {
            properties.runtime = inputs.Properties.Function.Runtime
        }
        if (inputs.Properties.Region) {
            properties.region = inputs.Properties.Region
        }
        if (inputs.Properties.Function.MemorySize) {
            properties.memorySize = inputs.Properties.Function.MemorySize
        }
        if (inputs.Properties.Function.Timeout) {
            properties.timeout = inputs.Properties.Function.Timeout
        }
        if (inputs.Properties.Function.Environment) {
            properties.environment = {variables: {}}
            for (let i = 0; i < inputs.Properties.Function.Environment.length; i++) {
                properties.environment.variables[inputs.Properties.Function.Environment[i].Key] = inputs.Properties.Function.Environment[i].Value
            }
        }
        if (inputs.Properties.Function.InternetAccess) {
            properties.publicAccess = inputs.Properties.Function.InternetAccess
        }
        if (inputs.Properties.Function.VPC) {
            properties.vpcConfig = {
                vpcId: inputs.Properties.Function.VPC.VpcId,
                subnetId: inputs.Properties.Function.VPC.SubnetId
            }
        }
        if (inputs.Properties.Function.Cfs) {
            properties.cfs = []
            for (let i = 0; i < inputs.Properties.Function.Cfs.length; i++) {
                properties.cfs.push({
                    cfsId: inputs.Properties.Function.Cfs[i].CfsId,
                    mountInsId: inputs.Properties.Function.Cfs[i].MountInsId,
                    localMountDir: inputs.Properties.Function.Cfs[i].MountDir.local,
                    remoteMountDir: inputs.Properties.Function.Cfs[i].MountDir.remote
                })
            }
        }
        if (inputs.Properties.Function.DeadLetter) {
            properties.deadLetter = {
                type: inputs.Properties.Function.DeadLetter.Type,
                name: inputs.Properties.Function.DeadLetter.Name,
                filterType: inputs.Properties.Function.DeadLetter.FilterType,
            }
        }
        if (inputs.Properties.Function.Layers) {
            properties.layers = []
            for (let i = 0; i < inputs.Properties.Function.Layers.length; i++) {
                properties.layers.push({
                    name: inputs.Properties.Function.Layers[i].Name,
                    version: inputs.Properties.Function.Layers[i].Version
                })
            }
        }
        if (inputs.Properties.Function.Cls) {
            properties.cls = {
                logsetId: inputs.Properties.Function.Cls.LogsetId,
                topicId: inputs.Properties.Function.Cls.TopicId,
            }
        }
        if (inputs.Properties.Function.Eip) {
            properties.eip = inputs.Properties.Function.Eip
        }
        if (inputs.Properties.Function.Tags) {
            properties.tags = {}
            for (let i = 0; i < inputs.Properties.Function.Tags.length; i++) {
                properties.tags[inputs.Properties.Function.Tags[i].Key] = inputs.Properties.Function.Tags[i].Value
            }
        }
        if (inputs.Properties.Function.Triggers) {
            properties.events = []
            for (let i = 0; i < inputs.Properties.Function.Triggers.length; i++) {
                const tempTrigger = inputs.Properties.Function.Triggers[i]
                const tempType = tempTrigger.Type
                const tempAttr = {}
                tempTrigger.Parameters.ServiceName = tempTrigger.Name
                tempAttr[tempType] = {
                    name: tempTrigger.Name,
                    parameters: tempType == "apigw" ? await this.getApigwInputs(tempTrigger.Parameters) : await this.getProperties(tempTrigger.Parameters)
                }
                properties.events.push(tempAttr)
            }
        }
        if (inputs.Properties.Function.CodeUri) {
            properties.src = await this.getProperties(inputs.Properties.Function.CodeUri)
        }
        if (inputs.Properties.Service && inputs.Properties.Service.Name) {
            properties.namespace = inputs.Properties.Service.Name
        }

        const region = properties.region || CONFIGS.region

        const state = this.state
        const args = inputs.Args

        // apigateway
        if (state && state.apigw && properties.events) {
            for (let i = 0; i < properties.events.length; i++) {
                if (properties.events[i].apigw) {
                    if (properties.events[i].apigw.name && state.apigw[properties.events[i].apigw.name]) {
                        properties.events[i].apigw.serviceId = state.apigw[properties.events[i].apigw.name]
                    }
                }
            }
        }

        // prepare scf inputs parameters
        const {scfInputs, existApigwTrigger, triggers, useDefault} = await prepareInputs(
            this,
            credentials,
            appId,
            properties
        )


        const scf = new Scf(credentials, region)
        const scfOutput = await scf.deploy(scfInputs)

        const outputs = {
            functionName: scfOutput.FunctionName,
            description: scfOutput.Description,
            region: scfOutput.Region,
            namespace: scfOutput.Namespace,
            runtime: scfOutput.Runtime,
            handler: scfOutput.Handler,
            memorySize: scfOutput.MemorySize
        }

        if (scfOutput.Layers && scfOutput.Layers.length > 0) {
            outputs.layers = scfOutput.Layers.map((item) => ({
                name: item.LayerName,
                version: item.LayerVersion
            }))
        }

        // default version is $LATEST
        outputs.lastVersion = scfOutput.LastVersion
            ? scfOutput.LastVersion
            : this.state.lastVersion || '$LATEST'

        // default traffic is 1.0, it can also be 0, so we should compare to undefined
        outputs.traffic =
            scfOutput.Traffic !== undefined
                ? scfOutput.Traffic
                : this.state.traffic !== undefined
                ? this.state.traffic
                : 1

        if (outputs.traffic !== 1 && scfOutput.ConfigTrafficVersion) {
            outputs.configTrafficVersion = scfOutput.ConfigTrafficVersion
            this.state.configTrafficVersion = scfOutput.ConfigTrafficVersion
        }

        this.state.lastVersion = outputs.lastVersion
        this.state.traffic = outputs.traffic

        // handle apigw event outputs
        if (existApigwTrigger) {
            const stateApigw = {}
            scfOutput.Triggers.forEach((apigwTrigger) => {
                if (apigwTrigger.serviceId) {
                    stateApigw[apigwTrigger.serviceName] = apigwTrigger.serviceId
                    apigwTrigger.apiList.forEach((endpoint) => {
                        if (getType(apigwTrigger.subDomain) === 'Array') {
                            apigwTrigger.subDomain.forEach((item) => {
                                triggers['apigw'].push(
                                    `${getDefaultProtocol(apigwTrigger.protocols)}://${item}/${
                                        apigwTrigger.environment
                                    }${endpoint.path}`
                                )
                            })
                        } else {
                            triggers['apigw'].push(
                                `${getDefaultProtocol(apigwTrigger.protocols)}://${apigwTrigger.subDomain}/${
                                    apigwTrigger.environment
                                }${endpoint.path}`
                            )
                        }
                    })
                }
            })
            this.state.apigw = stateApigw
        }

        outputs.triggers = triggers

        if (useDefault) {
            outputs.templateUrl = CONFIGS.templateUrl
        }

        this.state.region = region
        this.state.function = scfOutput

        // must add this property for debuging online
        this.state.lambdaArn = scfOutput.FunctionName

        await this.save()

        console.log(`Deployed Tencent ${CONFIGS.compFullname}...`)

        return outputs
    }

    // eslint-disable-next-line
    async remove(inputs = {}) {
        const credentials = this.getCredentials()
        const {region} = this.state
        const functionInfo = this.state.function

        console.log(`Removing Tencent ${CONFIGS.compFullname}...`)
        const scf = new Scf(credentials, region)
        if (functionInfo && functionInfo.FunctionName) {
            await scf.remove(functionInfo)
        }
        this.state = {}
        console.log(`Removed Tencent ${CONFIGS.compFullname}`)
    }
}

module.exports = SCFComponent
