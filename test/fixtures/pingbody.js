module.exports = ({addedUser, addedDevice}) => {
  return expect.objectContaining({
    pong: true,
    tosAndPrivacyPolicyVersion: expect.any(Number),
    badge: expect.any(Number),
    auth: {
      user: {
        uuidv4: addedUser.user.uuid,
        slug: expect.any(String),
        name: expect.any(String)
      },
      device: {
        uuidv4: addedDevice.device.uuid,
        idempotence: expect.any(Number)
      },
      call: {
        hash: expect.any(String),
        idempotence: expect.any(Number),
        uuidv4: expect.any(String)
      }
    }
  })  
}
