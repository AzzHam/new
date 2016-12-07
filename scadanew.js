// importing the modules we will need: Express for Server, Request for Client
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser');
    app.use(bodyParser.json());
var mysql = require('mysql');
var MasterRec = require('./MasterRecnew.js');
var ControlRec = require('./ControlRecnew.js');
var Request = require('request');

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '85412129',
    database: 'fis_assignment4'
});

connection.connect();


var repo = {
  masterRecs: {},
  contorlRecs: {}
};


/* 18.04: --------------------------------------------------------------------------------------
* CRUD for master-recipes
* POST: obtains frame, screen and keyboard from the request body (you will need a body parser to
* make it work require('body-parser'))
*/

app.post("/master-recipes", function (req, res) {
    
    var ID = req.query.id;
    connection.query('SELECT * FROM orderdetails WHERE id = ?', ID , function (err, result1) {
        if (err) {
            console.error(err);
            console.log('\n(scada)ERROR. UUID received, Query sent to DB, Unknown UUID, please try again!')
            res.send('Error! Unknown UUID!');
            return;
        }
        else {            
            connection.query('SELECT quantity FROM orders WHERE id = ?', ID, function (err, result2) {
                if (err) {
                    console.error(err);
                    console.log('\n(scada)ERROR. UUID received, Query sent to DB, Unknown UUID, please try again!')
                    res.send('Error! Unknown UUID!');
                    return;
                }
                else {
                    var frame = result1[0].frame;
                    var screen = result1[0].screen;
                    var keyboard = result1[0].keyboard;
                    var quantity = result2[0].quantity;
                    console.log('\n(scada) request for creating master recipe received and order details fetched from DB succesfully ')
                    //ID is added to inputs of this function to set the ID comming from ERP as ID of master recipe
                    var mr = new MasterRec(frame, screen, keyboard, ID);
                    // put to the repository using MasterRec generated id
                    // NOTE that using database you may need to invert it, so that repo will give you an id to
                    // create the master
                    var mrsteps = []
                    for (i = 0; i < quantity; i++) {
                        //to copy master recipe as many times as needed according to quantity of order
                        mrsteps = mrsteps.concat(mr.steps)
                    }
                    var mrnew = {
                        id: mr.id,
                        steps: mrsteps
                    }
                    repo.masterRecs[mrnew.id] = mrnew;
                    res.send({ url: mrnew.id });
                }
            })
        }
    });  
});

//GET all master recipe by id
app.get("/master-recipes", function(req, res){
  //should execute the first node. in this case loadPalletReq
  res.send(repo.masterRecs);
});

//GET master recipe by id
app.get("/master-recipes/:id", function(req, res){
  //here you can check as well if exists and return 404 on wrong id
  var id = req.params.id;
  // I have updated it to keep both the data and hypermedia
  var response = {
    data: repo.masterRecs[id],
    hypermedia: {
      createRec: {
        url: '/control-recipes?fromMaster=' + id,
        method: 'POST'
      }
    }
  }
  res.send(response);
});


//PUT: the master recipe to certain id
app.put("/master-recipes/:id", function(req, res){
  //should execute the first node. in this case loadPalletReq

  var id = req.params.id;

  var frame = req.body.frame;
  var screen = req.body.screen;
  var keyboard = req.body.keyboard;

  var mr = new MasterRec(frame, screen, keyboard);
  // same as in POST, but we already know ID
  repo.masterRecs[id] = mr;
  res.send();
});


//DELETE remove the master recipe
app.delete("/master-recipes/:id", function(req, res){
  //should execute the first node. in this case loadPalletReq

  var id = req.params.id;
  // Delete object
  delete repo.masterRecs[id];
  res.send();
});



// control recipes
// POST: create from master
app.post("/control-recipes", function (req, res) {
  //some data from query
    var masterID = req.query.fromMaster;
  //some data from body
    var body = req.body;
  // new ControlRec, gettin the master by id. Consider checking if exists
  var cr = new ControlRec (repo.masterRecs[masterID], body);

  repo.contorlRecs[cr.id] = cr;
  // returning some hypermedia
  var response = {
    data: '/control-recipes/' + cr.id,
    hypermedia: {
      start: {
         // url: '/control-recipes/' + cr.id + '?action=start',
          url: cr.id + '?action=start',
        method: 'POST'
      }
    }
  }
  res.send(response);
});

//GET all control recipes
app.get("/control-recipes", function(req, res){
  res.send(repo.contorlRecs);
});

//GET control rec by id
app.get("/control-recipes/:id", function(req, res){
  //should execute the first node. in this case loadPalletReq
  var id = req.params.id;
  res.send(repo.contorlRecs[id]);
});

//POST action
app.post("/control-recipes/:id", function(req, res){
  //should execute the first node. in this case loadPalletReq
  var action = req.query.action;
  res.send(); // we can reply before we have finished, not to block the client.
  if (action === "start") {
      var id = req.params.id;
      execute(id, 0);
      console.log('\nstart request received\n')
      var ID = id.slice(11)
      connection.query('SELECT * FROM Orders WHERE id = ?', ID, function (err, result) {
          console.log('select query sent')
          if (err) {
              console.error(err);
              console.log('\n(sada)ERROR. UUID received, Query sent to DB, Unknown UUID, please try again!')
              return;
          }
          else {
              var product = {
                  id: result[0].id,
                  quantity: result[0].quantity,
                  customer: result[0].customer,
                  ordertime: result[0].date,
                  model: result[0].model,
                  status: '',
                  arrivalTime: new Date(),

              }
              var qq = 'INSERT INTO products  (id, quantity, model, customer, arrivalTime, ordertime, status) VALUES (\'' + product.id + '\',\'' + product.quantity + '\',\'' + product.model + '\',\'' + product.customer + '\',\'' + product.arrivalTime + '\',\'' + product.ordertime + '\',\'' + product.status + '\')'
              connection.query(qq, function (err, result) {
                  //error handling
                  if (err) {
                      console.log('\nInserting requested new customer details was not successful. The error is : ' + err)
                      return;
                  } else {
                      console.log('\n(scada)inserting products into DB done succesfully')

                  }
              })
          }
      })

  }

});

var execute = function (id, step) {
  // getting recipe ! check if exists`
    var rec = repo.contorlRecs[id];
  // getting execution details
  var exec = rec.executeStep(step);
    // creating reqiest details
  var options = {
    url: exec.url,
    method: "POST",
    //here we are using our server url:
    json:{destUrl: "http://130.230.156.239:2002/notifications/" + exec.callback} //
  }
  //logging request. just for debugging purposes, so that you can see if something goes wrong
  console.log(JSON.stringify(options));
  //request from require('request')
  Request(options , function(error, response, body){
      if(error) {
          console.log(error);
      } else {
          console.log(response.statusCode, body);
          var id1 = id.slice(11);
          //updating orders in database
          
          connection.query('UPDATE orders,products SET orders.status = \'In progression\',products.status=\'in progression\' WHERE orders.id = ? and products.id=orders.id', id1, function (err, result) {
              if (err) {
                  console.log(err);
              }
              else {
                  console.log('\nStatus updated to "In progression!"');
                  
              }
          });   
          
      }
    });
}

/* Notifications receiver endpoint.
 * now works with recipe id and step id both
 */
app.post("/notifications/:recipeId/:stepId", function (req,res){
  var stepId = req.params.stepId; // getting the parameter from the url
  var recipeId = req.params.recipeId; // getting the parameter from the url
   // just logging the steps
  console.log(recipeId, ':', stepId);
  
  if (stepId === 'done') {
      // if the parameter is "done" - stop execution
      console.log('\ndone');
      connection.query('UPDATE orders,products SET orders.status = \'done\',products.status=\'done\' WHERE orders.id = ? and products.id=orders.id', recipeId, function (err, result) {
          if (err) {
              console.log(err);
          }
          else {
              console.log('\nStatus updated to "done!"');
              // console.log(result)
          }
      });

  } else {
      execute(recipeId, stepId);
  }
  res.send();// do not forget to response to the simulator on Notifications
});

  
// starting the server
app.listen(2002, function() {
  console.log('Scada index started.');
  }
);
