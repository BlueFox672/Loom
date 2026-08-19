const express = require("express")

const app = express()

app.use(express.static("Public"))

app.listen(process.env.PORT || 3000)
