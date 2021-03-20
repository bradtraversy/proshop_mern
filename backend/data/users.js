import bcrypt from 'bcryptjs'

const users = [
  {
    name: 'Carlitos',
    email: 'carlitosdiazplaza@gmail.com',
    phone: 123123123,
    password: bcrypt.hashSync('carlitos', 10),
    isAdmin: true,
  },
  {
    name: 'fake user',
    email: 'fake@user.com',
    phone: 123456789,
    password: bcrypt.hashSync('123456', 10),
  },

  {
    name: 'Anaid',
    email: 'anna.sweet.treats1@gmail.com',
    password: bcrypt.hashSync('1234567', 10),
    phone: 3213169898,
  },

  {
    name: 'Cuchito',
    email: 'jennyann1900@gmail.com',
    password: bcrypt.hashSync('12345', 10),
    phone: 9412241056,
    isAdmin: true,
  },

]

export default users