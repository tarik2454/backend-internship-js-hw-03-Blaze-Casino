const mongoose = require('mongoose');
const app = require('./app');

mongoose
  .connect(process.env.DB_HOST, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    writeConcern: { w: 'majority' },
  })
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(
        'Database connection successful. Server running. Use our API on port: 3000'
      );
    });
  })
  .catch(error => {
    console.warn(error.message);
    process.exit(1);
  });
