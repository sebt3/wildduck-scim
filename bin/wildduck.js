const ScimGateway = require('scimgateway')
const path = require('path')
const axios = require('axios')
const scimgateway = new ScimGateway()
const pluginName = path.basename(__filename, '.js')
const configDir = path.join(__dirname, '..', 'config')
const configFile = path.join(`${configDir}`, `${pluginName}.json`)
let config = require(configFile).endpoint
config = scimgateway.processExtConfig(pluginName, config)
scimgateway.authPassThroughAllowed = false

const wildduck = axios.create({
    baseURL: config.api,
    headers: {
        'Accept': 'application/json',
        'X-Access-Token': config.token
    }
});
const log = scimgateway.logger
const findUser = async (username) => {
    log.debug(`${pluginName} handling "findUser" username=${username}`)
    return await wildduck.get(`/users/resolve/${username}`).then(res => res.data?res.data:{ success: false }).catch(()=>{ success: false })
}

const wdUser2scim = (user) => {
    return {
        userName: user.username,
        id: user.username,
        name: {
            formatted: user.name
        },
        displayName: user.name
    }
}

scimgateway.createUser = async (baseEntity, userObj, ctx) => {
    log.debug(`${pluginName} handling "createUser" userObj=${JSON.stringify(userObj)}`)
    try {
        let found = await findUser(userObj.userName)
        if (found !== undefined && found.success)
            return await scimgateway.modifyUser(baseEntity, userObj.userName, userObj, ctx)
        else
            return await wildduck.post('/users', {
                username: userObj.userName,
                name: userObj.name.formatted || userObj.displayName,
                password: config.defaultPasswd,
                hashedPassword: false,
                allowUnsafe: true,
                address: `${userObj.userName}@${config.domain}`
            }).then((res)  => { log.debug(`got from wildduck api ${JSON.stringify(res.data)}`); return null
            }).catch((err) => { log.error(`error at createUser: ${err}`); throw err })
    } catch(err) { log.error(`error catched at createUser: ${err}`);throw err; }
}

scimgateway.modifyUser = async (baseEntity, id, userObj, ctx) => {
    log.debug(`${pluginName} handling "modifyUser" id=${id} userObj=${JSON.stringify(userObj)}`)
    try {
        let found = await findUser(id)
        if (found !== undefined && found.success)
            return await wildduck.put(`/users/${found.id}`, {
                name: userObj.name.formatted || userObj.displayName,
            }).then((res)  => { log.debug(`got from wildduck api ${JSON.stringify(res.data)}`); return null
            }).catch((err) => { log.error(`error at modifyUser: ${err}`);throw err; })
        throw new Error('modifyUser: Cannot modify unexisting users')
    } catch(err) { log.error(`error catched at modifyUser: ${err}`);throw err; }
}

scimgateway.deleteUser = async (baseEntity, id, ctx) => {
    log.debug(`${pluginName} handling "deleteUser" id=${id}`)
    try {
        return await wildduck.delete(`/users/${id}`)
          .then((res)  => { log.debug(res.data); return res.data
        }).catch((err) => { log.error(err);throw err; })
    } catch(err) { log.error(err);throw err; }
}

scimgateway.getUsers = async (baseEntity, getObj, attributes, ctx) => {
    log.debug(`${pluginName} handling "getUsers" getObj=${JSON.stringify(getObj)} attributes=${JSON.stringify(attributes)}`)
    let ret = {
        Resources: [],
        totalResults: 0
    }

    if (getObj.attribute === "id" && getObj.operator === "eq"){
        try {
            let found = await findUser(getObj.value)
            if (found !== undefined && found.success){
                user =  await wildduck.get(`/users/${found.id}`).then(res => res.data).catch(err => {log.error(`error at getUsers: ${err}`); throw err})
                ret.Resources.push(wdUser2scim(user))
            }
        } catch(err) { log.error(`error catched at getUsers(id=${getObj.value}): ${err}`); }
    } else {
        //TODO: support for filters
        try {
            ret.Resources = await this.wildduck.get('/users').then((res) => res.data.results).map(wdUser2scim)
        } catch(err) { log.error(`error catched at getUsers(): ${err}`); }
    }
    if (ret.totalResults == 0)
        ret.totalResults = ret.Resources.length
    return ret
}

// No support for groups
scimgateway.createGroup = async () => null;
scimgateway.deleteGroup = async () => null;
scimgateway.modifyGroup = async () => null;
scimgateway.getGroups = async () => {
    return {
        Resources: [],
        totalResults: 0
    }
}
