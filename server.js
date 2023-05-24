const app = require('./app');

// Menentukan port yang akan digunakan
const port = process.env.PORT || 3000;

// Menjalankan aplikasi di port yang ditentukan
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});