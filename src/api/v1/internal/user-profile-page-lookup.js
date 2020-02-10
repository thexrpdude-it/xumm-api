const log = require('debug')('app:user-profile-page')

module.exports = async (params, expressApp, invoker) => {
  if (invoker !== 'web') {
    throw new Error('User profile: invoker not implemented')
  }
  // const db = expressApp.db

  log('user-profile-page', params)

  return params
}
