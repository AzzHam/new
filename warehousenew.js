var uuid = require('node-uuid');
var mysql = require('mysql');

var connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '85412129',
    database: 'fis_assignment4'
});

connection.connect();

var warehouseView = {

};


warehouseView.createView = function (warehouse, parent) {
  var keys = Object.keys(warehouse);
  var response = {};
  for (var keyId in keys){
    var key = keys[keyId];
    var value = parent + '/' + key;
    response[key] = value;
  }
  return response;
};

var materialsController = {

};


materialsController.createMaterial = function (material) {


    connection.query('INSERT INTO materials  (id, type, quantity, date, status) VALUES ( ? , ? , ? , ? , ? )', material, function (err, rows, fields) {
        //error handling
        if (err) {
            console.log('Inserting requested new customer details was not successful. The error is : ' + err)
        }
        else { console.log('Materials inserted into database successfully') }
    })

    return id;
}


materialsController.readMaterial = function (material, callback) {

  //order of request is very importent, because it is the order of the respond and
  //then we have to get the respond with the same order we have selected which here is: kb,sc,fr 
  var sql = 'SELECT * FROM materials WHERE (materials.type = \'' + material.screen + '\')'
  sql = sql + 'OR (materials.type = \'' + material.frame + '\')'
  sql = sql + 'OR (materials.type = \'' + material.keyboard + '\')'
  connection.query(sql, function (err, rows, fields) {
      //error handling
      if (err) {
          callback(err);
      }
      //returning rows in a asyncronouse way!!
      callback(rows)
  })
  return null;
};


module.exports.materialsController = materialsController;
module.exports.ordersController = warehouseController;

