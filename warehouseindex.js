// server

var express = require('express'),
    app = express();
var uuid = require('node-uuid');
var mysql = require('mysql');
var Request = require('request');
var type = require('type-of-is');
var materialsController = require('./warehousenew.js').materialsController;
var warehouseController = require('./warehousenew.js').warehouseController;


var warehouseView = {
    materials: "/warehouse/materials",
    products: "/warehouse/products"
};


var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '85412129',
    database: 'fis_assignment4',
    //multipleStatements: true
});

connection.connect();

//new app.get module(!) for getting queries from data base and check them if they are available in the data base of not
app.get('/warehouse/materialcheck', function (request, Response) {
   // var id = request.params.id;
    console.log('(warehouseindex) checking for material availability \n');
    //recieving the ID of the order details to be checked in ware house for materials.
    var ID = request.query.id;    
    //getting order detail info from database
    var query = connection.query('SELECT * FROM orderdetails WHERE id = ?', ID, function (err, result) {

        if (err) {
            console.error(err);
            console.log('(warehouse)ERROR. UUID received, Query sent to DB, Unknown UUID, please try again!')
            res.send('Error! Unknown UUID!');
            return;
        }

        else {
           //building BOM to check with the quantities with DB  
            var mat = {
                screen: result[0].screen,
                screenquantity: result[0].screenquantity,
                frame: result[0].frame,
                framequantity: result[0].framequantity,
                keyboard: result[0].keyboard,
                keyboardquantity: result[0].keyboardquantity
            }

            materialsController.readMaterial(mat, function (rows) {

                console.log('(warehouseindex)this is the data received from materialsController.readMaterial module')
                console.log(rows[0].quantity + ':available,(screen),required:' + mat.screenquantity)
                console.log(rows[1].quantity + ':available,(frame),required:' + mat.framequantity)
                console.log(rows[2].quantity + ':available,(keyboard),required:' + mat.keyboardquantity)
                //here we check if there is enough of each matrial in the warehouse
                

                if (parseInt(rows[0].quantity) >= parseInt( mat.screenquantity) &&
                    parseInt(rows[1].quantity) >= parseInt(mat.framequantity) &&
                    parseInt(rows[2].quantity) >= parseInt(mat.keyboardquantity)) {

                    console.log('(warehouseindex)We have the requested bill of materials, details is: ' + mat.screen + ' OK - ' + mat.frame + ' OK - ' + mat.keyboard + ' OK')
                    //************************if there is enough of materials in the warehouse, in sends a "true" value as respont.
                   Response.send('true');


                    // if the materials are not enough, we have to make a bill of *needed* materials
                    // to send to ERP and ERP will send those materials to Warehouse directly

                } else {
                    console.log('\n(Warehouse index)the amount of materials required is not sufficient, preparing a request to get more material from ERP')
                    var erpOrderBomQuery1
                    var erpOrderBomQuery2
                    var erpOrderBomQuery3

                    //it makes bill of materials contailing the required materials
                    if (parseInt(rows[2].quantity) < parseInt(mat.keyboardquantity)) {

                        erpOrderBomQuery1 = 'kbid=' + (rows[2].id).toString() + '&kb=' + (mat.keyboard).toString() + '&kbq=' + (parseInt(mat.keyboardquantity) - parseInt(rows[2].quantity)).toString()
                    }

                    if (parseInt(rows[0].quantity) < parseInt(mat.screenquantity)) {

                        erpOrderBomQuery2 = 'scid=' + (rows[0].id).toString() + '&sc=' + (mat.screen).toString() + '&scq=' + (parseInt(mat.screenquantity) - parseInt(rows[0].quantity)).toString()
                    }

                    if (parseInt(rows[1].quantity) < parseInt(mat.framequantity)) {
                        erpOrderBomQuery3 = 'frid=' + (rows[1].id).toString() + '&fr=' + (mat.frame).toString() + '&frq=' + (parseInt(mat.framequantity) - parseInt(rows[1].quantity)).toString()
                    }
                    //makes the querry which is needed for any combination of materials needed
                    var erpOrderBomQuery = '?'

                    if (erpOrderBomQuery1) {
                        erpOrderBomQuery = erpOrderBomQuery + erpOrderBomQuery1

                        if (erpOrderBomQuery2) {
                            erpOrderBomQuery = erpOrderBomQuery + '&' + erpOrderBomQuery2

                            if (erpOrderBomQuery3) {
                                erpOrderBomQuery = erpOrderBomQuery + '&' + erpOrderBomQuery3
                            }

                        }
                        else {
                            if (erpOrderBomQuery3) {
                                erpOrderBomQuery = erpOrderBomQuery + '&' + erpOrderBomQuery3
                            }
                        }
                    }
                    else {
                        if (erpOrderBomQuery2) {
                            erpOrderBomQuery = erpOrderBomQuery + erpOrderBomQuery2
                            if (erpOrderBomQuery3) {
                                erpOrderBomQuery = erpOrderBomQuery + '&' + erpOrderBomQuery3
                            }
                        }
                        else {
                            if (erpOrderBomQuery3) {
                                erpOrderBomQuery = erpOrderBomQuery + erpOrderBomQuery3
                            }
                        }
                    }

                    //sending the query to ERP to get more materials
                    var erpOrderBom = {
                        url: "http://localhost:2000/WarehouseOrder/" + erpOrderBomQuery + '&ID=' + ID,
                        method: "GET",

                    }
                    Request(erpOrderBom, function (error, response, body) {
                        if (error) {
                            console.log('(warehouseindex) Error after sending aditional ,material request to ERP: ' + error);
                        } else {
                            console.log('(Warehouseindex), sending Required BOM to ERP was succesful');
                        }
                    });
                    
                }


            });

        }

    });
   
     
});


app.post('/warehouse/insertMaterial', function (request, response) {
    var query = request.query

    var material = {
        id: query.id,
        type: query.type,
        quantity: query.quantity,
        date: new date(),
        status: 'available'
    }

    if (material.hasOwnProperty(id) &&
        material.hasOwnProperty(type) &&
        material.hasOwnProperty(quantity)) {

        var ID = materialsController.createMaterial(material)
        response.status(200).send({code : '200' , description: 'materials inserted into database' + ID });
    } else {
        response.status(404).send({ code: '404', description: 'cannot find the category or item ', back: '/warehouse' });
    }
})

app.listen(2003, function() {
  console.log('Warehouseindex started.');}
);
