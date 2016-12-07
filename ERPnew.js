var uuid = require('node-uuid');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var mysql = require('mysql');
var bodyparser = require('body-parser')
var uuid = require('uuid');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var Request = require('request');
//requiring other servers 
//var MES = require('./MESnew.js');

app.use(bodyparser.urlencoded({ extended: true })); //support x-www-form-urlencoded
app.use(bodyparser.json());



//DB definitions
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '85412129',
    database: 'fis_assignment4',
    multipleStatements: true
});
connection.connect();




//INSERTING NEW ORDER

app.post('/ERP/Orders/', function (req, res) {

    //declaration for new variable which is modified by the query
    var order = {
        model: req.query.model,
        quantity: req.query.quantity,        
        customer: req.query.customer,
        id: uuid.v4(),
        date: new Date(),
        status: 'uncompleted'
    };
    console.log("testing")
    //function for creating the query              

    connection.query('INSERT INTO Orders set ?', order, function (err, result) {
        if (err) {
            console.log('\ncould not send order info to DB')
            console.error(err);
        }
            //if order saved in the database successfully, then MES should be informed to creat the BOM and check the warehouse
        else {
            // console.log(result)
            var Bomquery = '?id=' + order.id;
            var ErpToMesQuery = {
                url: "http://localhost:2001/MES/Orders" + Bomquery,
                method: "POST",
            }
            // console.log(ErpToMesQuery);
            Request(ErpToMesQuery, function (error, response, body) {
                //some error handling!!
                if (error) {
                    console.log('\nMES error after sending request to warehouse: ' + error);
                }
                else {
                    console.log('\nYour ordes sent to MES system for furthur proccess')
                }
            });
        }
    })
    console.log("\nOrder Created Succesfully!");
});



app.get('/WarehouseOrder/', function (request, response) {
    // var id = request.params.id;
    console.log('\n(ERP)Warehouse order received');

    var mat = {
        ID: request.query.ID,
        scid: request.query.scid,
        sc: request.query.sc,
        scq: request.query.scq,
        frid: request.query.frid,
        fr: request.query.fr,
        frq: request.query.frq,
        kbid: request.query.kbid,
        kb: request.query.kb,
        kbq: request.query.kbq
    }
    var query = ''
    if (mat.scid) {
        query = query + 'UPDATE materials SET materials.quantity=materials.quantity+\'' + mat.scq + '\' WHERE materials.id=\'' + mat.scid + '\';'
        if (mat.frid) {
            query = query + 'UPDATE materials SET materials.quantity=materials.quantity+\'' + mat.frq + '\' WHERE materials.id=\'' + mat.frid + '\';'
            if (mat.kbid) {
                query = query + 'UPDATE materials SET materials.quantity=materials.quantity+\'' + mat.kbq + '\' WHERE materials.id=\'' + mat.kbid + '\';'
            }
        }
        else {
            if (mat.kbid) {
                query = query + 'UPDATE materials SET materials.quantity=materials.quantity+\'' + mat.frq + '\' WHERE materials.id=\'' + mat.frid + '\';'
            }
        }
    }
    else {
        if (mat.frid) {
            query = query + 'UPDATE materials SET materials.quantity=materials.quantity+\'' + mat.frq + '\' WHERE materials.id=\'' + mat.frid + '\';'
            if (mat.kbid) {
                query = query + 'UPDATE materials SET materials.quantity=materials.quantity+\'' + mat.kbq + '\' WHERE materials.id=\'' + mat.kbid + '\';'
            }
        }
        else {
            if (mat.kbid) {
                query = query + 'UPDATE materials SET materials.quantity=materials.quantity+\'' + mat.kbq + '\' WHERE materials.id=\'' + mat.kbid + '\';'
            }
        }
    }

    //notice the material controller and read material     
    connection.query(query, function (err, result) {
        if (err) {
            console.error(err);
            console.log('\nUnknown UUID, please try again!')
            return;
        }
        else {
            console.log('\n(ERP)Put Query sent directly to database successfully')

            var Bomquery = '?id=' + mat.ID;
            var ErpToMesQuery = {
                url: "http://localhost:2001/MES/Orders" + Bomquery,
                method: "POST",
            }
            Request(ErpToMesQuery, function (error, response, body) {
                //some error handling!!
                if (error) {
                    console.log('\nMES error after sending request to warehouse: ' + error);
                }
                else {
                    console.log('\nmaterials ready sent to MES')
                }
            });
        }
    })

})




//READING AN ORDER'S STATUS FROM THE DB 
app.get('/ERP/Orders/:uuid', function (req, res) {

    //declaration for new variable which is modified by the query
    var id2 = {
        uuid: req.params.uuid
    };
    var uuid2 = id2.uuid;
    console.log(JSON.stringify(uuid2));
    //function for creating the query
    var createQuery = function () {
        var query = connection.query('SELECT status FROM Orders WHERE id = ?', uuid2, function (err, result) {
            if (err) {
                console.error(err);
                console.log('\nUnknown UUID, please try again!')
                res.send('Error! Unknown UUID!');
                return;
            }
            else {
                res.status(200).send(result);
            }
        });
    }
    createQuery();
    console.log("\nStatus Read Succesfully!");
})


//READING THE ORDERS IN THE DB AND RETURNING THEIR ID'S

app.get('/ERP/Orders/', function (req, res) {
    //function for creating the query
    var createQuery = function () {
        var query = connection.query('SELECT id FROM Orders', function (err, result) {
            if (err) {
                throw (err)
                console.log('\nAn error occurred, please try again!')
                res.status(404).send({ code: '404', description: 'cannot find order ', back: '/ERP/Orders' });
                return;
            }
            else {
                var body = ('Back to orders /ERP/Orders' && result);
            }
            res.status(200).send(body);
        });
    };
    createQuery();
    console.log("\nOrders Read Succesfully! ");
});


//UPDATING THE ORDER'S STATUS
//IDENTIFYING THE CORRECT ORDER WITH IT'S UUID
app.put('/ERP/Orders/:uuid', function (req, res) {
    //declaration for new variables which are modified by the query
    var id2 = {
        uuid: req.params.uuid
    }
    var uuid2 = id2.uuid;
    var newStatus = req.body.status;
    //function for creating the query
    var createQuery = function () {
        var query = connection.query('UPDATE Orders SET status = ? WHERE id = ?', [newStatus, uuid2], function (err, result) {
            if (err) {
                console.error(err);
                console.log('\nUnknown UUID, please try again!')
                res.send('Error! Unknown UUID!');
                return;
            }
            else {
                res.status(200).send(result);
            }
        });
    };
    createQuery();
    console.log("Status Updated Succesfully!");
});

//FOR SHIPPING THE ITEM WE NEED TO DELETE IT FROM TABLE "ORDERS".
//Before this it could be added to a table "products".
//The Status should be "1" at this point so we know that the order is finished. 

//DELETING AN ORDER, SEARCH BY ID

app.delete('/ERP/Orders/:id', function (req, res) {

    //Copying the details into the "products"-table before deleting
    //creating a variable for handling the id
    var copy_id = {
        uuid1: req.params.id
    }
    //creating another variable from previously read data
    var id_copy = copy_id.uuid1;
    var createQuery1 = function () {
        //Implementing the SQL query for copying the details of the order into the products
        var query = connection.query('INSERT INTO products SELECT * FROM Orders WHERE id = ?', id_copy, function (err, result) {
            if (err) {
                console.error(err);
                console.log('\nUnknown Order Id, please try again!')
                //res.status(404).send({code: '404', description: 'cannot find order ', back: '/ERP/Orders/' });
                return;
            }
            else {
                //res.status(200).send('Back to orders /ERP/Orders/');
                console.log('\nShipment in process.');
            }
            //cannot have a res.status here because in the end of this function there's one.
            // Only one response allowed per function. Otherwise error & horror. 
        });

    };

    //declaration for new variable which is modified by the query
    var del_id = {
        uuid2: req.params.id
    };

    //creating a new variable from a partition of the above
    var id_del = del_id.uuid2;
    console.log(JSON.stringify(id_del));
    //function for creating the query
    var createQuery = function () {

        //Implementing the SQL query for deleting the order from the table "Orders". 
        var query = connection.query('DELETE FROM Orders WHERE id = ?', id_del, function (err, result) {
            if (err) {
                console.error(err);
                console.log('\nUnknown Order Id, please try again!')
                res.status(404).send({ code: '404', description: 'cannot find order ', back: '/ERP/Orders/' });
                return;
            }
            else {
                res.status(200).send('Back to orders /ERP/Orders/');
            }
            //console.log('kakkaa');

        });

    };
    createQuery1();
    createQuery();
    console.log("\nOrder Shipped Succesfully!");

});

//READING THE PRODUCTS IN THE DB AND RETURNING THEIR ID'S

app.get('/ERP/products/', function (req, res) {

    //function for creating the query
    var createQuery = function () {

        var query = connection.query('\nSELECT id FROM products', function (err, result) {
            if (err) {
                throw (err)
                console.log('An error occurred, please try again!')
                res.status(404).send({ code: '404', description: 'cannot find products ', back: '/ERP/' });
                return;
            }
            else {
                var body = ('Back to products /ERP/products' && result);
            }
            res.status(200).send(body);
        });
    };
    createQuery();
    console.log("Products Read Succesfully! ");
});

//FUNCTIONS FOR UPDATING AN ORDER'S STATUS ACCORDING TO SCADA
//need somehow to get the orders' id's.
//Status "codes":
//WFP = waiting for production
//IP = in production
//PC = product complete.
//Each will fire when EventEmitter@SCADA emits corresponding status code as a string literal

var status_waiting = function status_waiting(req,res){
connection.query('UPDATE Orders SET Orders.status =' + 'Waiting for production.' + 'WHERE id = ?', id, function(err,result){
    if(err) {
        console.log(err);
    }
    else {
    res.status(200).send(result);
    console.log('Status updated to "Waiting for production"')
        }
    })
}
eventEmitter.on('WFP', status_waiting);

var status_progressing = function status_progressing(status,id){
connection.query('UPDATE Orders SET Orders.status =' + 'In production, please wait.' + 'WHERE id = ?', id, function(err,result){
    if(err) {
        console.log(err);
    }
    else {
    res.status(200).send(result);
    console.log('Status updated to "In production"')
        }
    })
}
eventEmitter.on('IP', status_waiting);

var status_waiting = function status_complete(status,id){
connection.query('UPDATE Orders SET Orders.status =' + 'Order complete!' + 'WHERE id = ?', id, function(err,result){
    if(err) {
        console.log(err);
            }
    else {
    res.status(200).send(result);
    console.log('Status updated to "Complete"')
        }
    })
}
eventEmitter.on('PC', status_waiting);



//Template for a loop. 

var now = new Date();
var daysOfYear = [];
for (var d = new Date(2012, 0, 1); d <= now; d.setDate(d.getDate() + 1)) {
    daysOfYear.push(new Date(d));
;
};




app.listen(2000, function() {
  console.log('ERP started.');}
);

