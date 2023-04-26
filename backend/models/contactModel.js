import mongoose from 'mongoose'

const contactSchema = mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

const Contact = mongoose.model('Contact', contactSchema)
export default Contact
