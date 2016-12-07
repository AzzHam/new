//var uuid = require('node-uuid');
var express = require('express');
var app = express();
//var http = require('http').Server(app);
var mysql = require('mysql');
//var bodyparser = require('body-parser');
//var events = require('events');
//var eventEmitter = new events.EventEmitter();
var Request = require('request');
var type = require('type-of-is');//used for debugging, shows the attribute of variables

app.use(bodyparser.urlencoded({ extended: true })); //support x-www-form-urlencoded
app.use(bodyparser.json());


var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '85412129',
    database: 'fis_assignment4'
});

connection.connect();


//console.log(bte);
var erpOrderToBom = function (id, model, quantity) {
    if (model === 'model-A' ) {
        Bom = {
            id: id,
            keyboard: 'keyboard1',
            keyboardquantity: quantity,
            screen: 'screen1',
            screenquantity: quantity,
            frame: 'frame1',
            framequantity: quantity
        }
    }
    if (model === 'model-B') {

        Bom = {
            id: id,
            keyboard: 'keyboard2',
            keyboardquantity: quantity,
            screen: 'screen2',
            screenquantity: quantity,
            frame: 'frame2',
            framequantity: quantity
        }
    }
    if (model === 'model-C') {

        Bom = {
            id: id,
            keyboard: 'keyboard3',
            keyboardquantity: quantity,
            screen: 'screen3',
            screenquantity: quantity,
            frame: 'frame3',
            framequantity: quantity
        }
    }
    return Bom;            
}


//************************latest edit, change the integration point to DB*********************02/05
//************************adding query from DB by evoking by Id from ERP**********************02/05


app.post('/MES/Orders', function (request, response) {   //orders are being sent to /MES/Orders from ERP layer
    // var warehouse = warehouseController.readWarehouse();
    var qry = request.query;      //only receives ID from ERP
    if (qry.hasOwnProperty('id')) {  //checks if ID is available
        //sends query to DB and receives the order details to make BOM and send it to warehouseindex.
        var query = connection.query('SELECT * FROM Orders WHERE id = ?', qry.id, function (err, result) {
            if (err) {
                console.error(err);
                console.log('\n(MES)ERROR. UUID received, Query sent to DB, Unknown UUID, please try again!')
                response.send('Error! Unknown UUID!');
                return;
            }
            else {
                response.status(200).send(result);
                console.log('\n(MES), Query to receive order from DB sent successfully and the result is:')
                //making bill of materials from received order. detailes received from DB by sending a query containing ID
                var Bom = erpOrderToBom(result[0].id, result[0].model, result[0].quantity);
                //sending order detail (bill of materials) to DB.   

                connection.query('INSERT INTO orderdetails set ?', Bom, function (err, result) {
                    if (err) {
                        console.error('\n(MES) sending BOM to database has some errors' + err);
                    }
                });

                //sending a query to warehouse to check the availability of requiered materials
                var Bomquery = '?id=' + Bom.id;
                var warehouseBom = {
                    url: "http://localhost:2003/warehouse/materialcheck/" + Bomquery,
                    method: "GET",
                }
                Request(warehouseBom, function (error, response, body) {

                    if (error) {
                        console.log('\n(MES) error sending request to warehouse: ' + error);
                    }
                    //if there is enough of materials in the warehouse, mes will send the ID to scada to make the master recipe!
                    if (response.body === 'true') {

                        console.log('\n(MES) Required matrerial is available in the warehouse, ID will be sent to creat master recipe')
                        //sending the ID to scada to prepare for production
                        //to make a master recipe with ID received from ERP
                        var scadaMasterRecipeQuery = '?id=' + Bom.id
                        var scadaquery1 = {
                            url: "http://localhost:2002/master-recipes" + scadaMasterRecipeQuery,
                            method: "POST",
                        }

                        Request(scadaquery1, function (error, response, body) {
                            if (error) {
                                console.log('\nMES error after sending request to warehouse: ' + error);
                            }
                                //if everything goes well, then it is possible to send the ID of master recipe to control recipe to make one
                            else {
                                console.log('\n(MES) master-recipe query (ID) sent to scada');
                                //parsing the rosponse body to retrive url
                                var masterRecipeURL = JSON.parse(response.body)
                                //preparing a query to be sent to scada to make the control recipe
                                var scadaControlRecipeQuery = '?fromMaster=' + masterRecipeURL.url
                                var scadaquery2 = {
                                    url: "http://localhost:2002/control-recipes" + scadaControlRecipeQuery,
                                    method: "POST",
                                    //to make a control recipe, we need the master recipe data(ID) and a base url which is fastory simulator's RTU url 
                                    json: { baseUrl: 'http://escop.rd.tut.fi:3000' }
                                }
                                Request(scadaquery2, function (error, response, body) {
                                    if (error) {
                                        console.log('\nMES error after sending request to warehouse: ' + error);
                                    }
                                        //and if the control recipe is built successfully, start command will trigger from here
                                    else {
                                        //now we have to send production start message to scada
                                        var rr = response.body
                                        console.log('\nsending start request to control')
                                        //production start url is received from scada in the last step and used to evoke start module
                                        var scadaControlRecipeStartQuery = rr.hypermedia.start.url
                                        var scadaquery2 = {
                                            url: "http://localhost:2002/control-recipes/" + scadaControlRecipeStartQuery,
                                            method: "POST",
                                        }
                                        Request(scadaquery2, function (error, response, body) {
                                            if (error) {
                                                console.log('\nMES error after sending request to scada: ' + error);
                                            }
                                            else {
                                                //scada made the control recipe successfully and now we udpade the DB with new amount of materials 
                                                console.log('\nproduction procedure started.')
                                                var qq = 'UPDATE materials SET materials.quantity=materials.quantity - \'' + Bom.keyboardquantity + '\' WHERE materials.type = \''
                                                qq = qq + Bom.keyboard + '\' or materials.type =\'' + Bom.screen + '\' or materials.type = \'' + Bom.frame + '\';'
                                                connection.query(qq, function (err, result) {
                                                    if (err) {
                                                        console.log('\n(MES)ERROR. UUID received, Query sent to DB, Unknown UUID, please try again!')
                                                        // response.send('Error! Unknown UUID!');
                                                        console.error(err);
                                                    }
                                                    else { console.log('\nmaterials which are used for production removed from DB') }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                    else { return; }
                }
           )
            };
        });
    }

    else {
        response.status(400).send({ code: '400', description: 'Query not complete. the query from ERP to MES is crupted ' + type, back: '/warehouse', format: '/warehouse?category=cat&type=type' })
    }

});
//receiving product ID and sending it to warehouseindex to save the details about it
app.post('/warehouse/products', function (request, response) {
    var query = request.query;
    if (query.hasOwnProperty('id')) {
        console.log('\nproduct ID received in MES')
        var productToWarehousequery = {
            url: "http://localhost:2003/warehouse/products?id=" + query.id,
            method: "POST",
        }
        Request(query2, function (error, response, body) {
            if (error) {
                console.log('\nMES error after sending request to warehouse: ' + error);
            }
            else {
                console.log('\nproduct ID sent to warehouse')
            }
        });
    }

    else {
        response.status(400).send({ code: '400', description: 'Query not complete ' + type, back: '/warehouse', format: '/warehouse?category=cat&type=type' })
    }

});

app.listen(2001, function() {
  console.log('MES started.');}
);
