const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
  res.render('index', { title: 'micro:bit webusb serial monitor' });
});

module.exports = router;
