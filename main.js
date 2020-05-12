'use strict';
//DMXfaceXP Server Adapter for counter application with ioBroker
//REV 1.0.0

const adaptername = "dmxfacecount"

const utils = require('@iobroker/adapter-core');
var adapter  = utils.Adapter (adaptername);

//SERVER CONNECTION values
var PORT = 0;								//DMXface port of TCP server ACIVE SEND socket (Configured @ DMXface Setup)

// DMXface TCP Connection
var net = require ('net');

//FLAG, true when Server listening
var IS_ONLINE  = false;

//Local mirror of states
var LOCAL_COUNTER_TOTAL = 0;
var LOCAL_LIMIT_RED = 0;  
var LOCAL_LIMIT_YELLOW = 0;
var LOCAL_COUNTER_MODE = 0;

//Server and connection list
var connectedSockets = new Set();
var server = net.createServer();


//TCP SERVER
server.on ('connection', function (socket){
	var remoteAddress = socket.remoteAddress +":" + socket.remotePort;
	adapter.log.info (remoteAddress + "  DMXface connected");
	connectedSockets.add(socket);
	
	socket.on('end', function() {
        adapter.log.info (remoteAddress + " End");
		connectedSockets.delete(socket);
    });
	
	socket.on('close', function() {
        adapter.log.info (remoteAddress + " Closed");
		connectedSockets.delete(socket);
    });
	
	socket.on('error', function() {
        adapter.log.info (remoteAddress + " Error:"+ err.message);
		connectedSockets.delete(socket);
    });
	
	//RECEIVE from DMXFACE
	socket.on ('data',function(RX){
		//adapter.log.info (remoteAddress + " RX:" + RX.length + " bytes");
		var DELTA=0;
		if (RX[0] == 69) {DELTA = 1;}		//EIN
		if (RX[0] == 65) {DELTA = -1;}	    //AUS
		if (DELTA ==0) {return;}
		LOCAL_COUNTER_TOTAL+=DELTA;
		if (LOCAL_COUNTER_TOTAL <0){LOCAL_COUNTER_TOTAL=0};
		adapter.setState('COUNTER_TOTAL',LOCAL_COUNTER_TOTAL,true);
		//adapter.log.info ('Received DELTA:' + DELTA + '  COUNTER_TOTAL' +LOCAL_COUNTER_TOTAL);
	});
});

//Send to all clients connected
connectedSockets.broadcast = function(data) {
    for (let sock of this) {
            sock.write(data);
    }
}




//*************************************  ADAPTER STARTS with ioBroker *******************************************
adapter.on ('ready',function (){
	var i;
//Move the ioBroker Adapter configuration to the container values 
	PORT = adapter.config.port;

//Counter , Modus , Limits , werden auch Lokal gehalten 
	adapter.setObjectNotExists ("COUNTER_TOTAL",{
		type:'state',
			common:{name:'COUNTER_TOTAL',type:'number',role:'value',read:true,write:true},
			native:{}
		});		

//Ampel MODUS 0=Zählen / Auto , 1= Permanent ROT 2= Permanent GELB , ansonsten Permanent GRÜN
	adapter.setObjectNotExists ("COUNTER_MODE",{
		type:'state',
			common:{name:'COUNTER_MODE',type:'number',role:'value',read:true,write:true},
			native:{}
		});	

//LIMITS		
	adapter.setObjectNotExists ("LIMIT_RED",{
		type:'state',
			common:{name:'LIMIT_RED',type:'number',role:'value',read:true,write:true},
			native:{}
		});	
	adapter.setObjectNotExists ("LIMIT_YELLOW",{
		type:'state',
			common:{name:'LIMIT_YELLOW',type:'number',role:'value',read:true,write:true},
			native:{}
		});	

//Funktionsvariablen zum erhöhen , reduzieren oder löschen des Counters
	adapter.setObjectNotExists ("FNKTN_ADD",{
		type:'state',
			common:{name:'FNKTN_ADD',type:'number',role:'value',read:true,write:true},
			native:{}
		});		
	
	adapter.setObjectNotExists ("FNKTN_SUB",{
		type:'state',
			common:{name:'FNKTN_SUB',type:'number',role:'value',read:true,write:true},
			native:{}
		});	
		
	adapter.setObjectNotExists ("FNKTN_RESET",{
		type:'state',
			common:{name:'FNKTN_RESET',type:'boolean',role:'value',read:true,write:true},
			native:{}
		});	
//Ampel Status 0=Grün , 1= Gelb, 2= Rot
	adapter.setObjectNotExists ("OUTPUT_STATE",{
		type:'state',
			common:{name:'OUTPUT_STATE',type:'number',role:'value',read:true,write:false},
			native:{}
		});	

//Possiblility to send to DMXface (receiving as "SEND"+number with a trigger)
	adapter.setObjectNotExists ('SEND',{
		type:'state',
		common:{name:'SENDtoDMXface',type:'number',role:'value',read:true,write:true},
		native:{}
	});		
		

//Update local mirrors 
adapter.getState('COUNTER_TOTAL' , function (err, state) {	//get current counter value
			
			if (state !=null) {							//EXIT if state is not initialized yet
				if (state.val !=null) {					//Exit if value not initialized
					LOCAL_COUNTER_TOTAL= state.val;
				}
			}
			adapter.log.info ('COUNTER_TOTAL:' + LOCAL_COUNTER_TOTAL);
		});

adapter.getState('LIMIT_RED' , function (err, state) {	//get current counter value
			if (state !=null) {							//EXIT if state is not initialized yet
				if (state.val !=null) {					//Exit if value not initialized
					LOCAL_LIMIT_RED= state.val;
				}
			}
			adapter.log.info ('LIMIT_RED:' + LOCAL_LIMIT_RED);
		});

adapter.getState('LIMIT_YELLOW' , function (err, state) {	//get current counter value
			if (state !=null) {							//EXIT if state is not initialized yet
				if (state.val !=null) {					//Exit if value not initialized
					LOCAL_LIMIT_YELLOW= state.val;
				}
			}
			adapter.log.info ('LIMIT_YELLOW:' + LOCAL_LIMIT_YELLOW);
		});

adapter.getState('COUNTER_MODE' , function (err, state) {	//get current counter value
			if (state !=null) {							//EXIT if state is not initialized yet
				if (state.val !=null) {					//Exit if value not initialized
					LOCAL_COUNTER_MODE= state.val;
				}
			}
			adapter.log.info ('COUNTER_MODE:' + LOCAL_COUNTER_MODE);
		});		

//Enable receiving of change events for all objects
	adapter.subscribeStates('*');

//Start Server	
	server.listen (PORT,function () {
		adapter.log.info ("Server listen at Port: " + PORT);
		IS_ONLINE = true;
	});
});


//************************************* ADAPTER CLOSED BY ioBroker *****************************************
adapter.on ('unload',function (callback){
	IS_ONLINE = false;
	adapter.log.info ('Close server connection, cancel service');
	server.close;
	callback;
	});


//************************************* Adapter STATE has CHANGED ******************************************	
adapter.on ('stateChange',function (id,obj){
	//adapter.log.info (id + "  /  "+obj);
	if (!IS_ONLINE){return;}							//DMXface Offline	
	if (obj==null) {
		adapter.log.info ('Object: '+ id + ' terminated by user');
		return;
	}
	//adapter.log.info ('Object: '+ id + ' VAL:' + obj.val);
	
//Track state changes that are relevant for controlling the output
	if (id.search ('COUNTER_TOTAL') >-1)
	{
		LOCAL_COUNTER_TOTAL = obj.val;
		AMPELCONTROLLER();
		return;
	}
	
	if (id.search ('LIMIT_RED') >-1)
	{
		LOCAL_LIMIT_RED = obj.val;
		AMPELCONTROLLER();
		return;
	}
	
	if (id.search ('LIMIT_YELLOW') >-1)
	{
		LOCAL_LIMIT_YELLOW = obj.val;
		AMPELCONTROLLER();
		return;
	}
	
	if (id.search ('COUNTER_MODE') >-1)
	{
		LOCAL_COUNTER_MODE = obj.val;
		AMPELCONTROLLER();
		return;
	}
	
	if (obj.from.search (adaptername) != -1) {return;}    // do not process self generated state changes (by dmxface instance) 
														  //exit if sender = Adaptername
//Reset state
	if (id.search ('FNKTN_RESET') >-1)
	{
		adapter.setState('COUNTER_TOTAL',0,true);
		adapter.log.info ('COUNTER_TOTAL, RESET to 0');
		return;	
	}
//ADD State
	if (id.search ('FNKTN_ADD') >-1)
	{
		var ADDS = obj.val;
		if (ADDS <= 0){return;}
		LOCAL_COUNTER_TOTAL+=ADDS;
		adapter.setState('COUNTER_TOTAL',LOCAL_COUNTER_TOTAL,true);
		adapter.log.info ('Added to COUNTER_TOTAL:' + ADDS);
		return;	
	}
//Sub State	
	if (id.search ('FNKTN_SUB') >-1)
	{
		var SUBS = obj.val;
		if (SUBS <= 0){return;}
		LOCAL_COUNTER_TOTAL-=SUBS;
		if (LOCAL_COUNTER_TOTAL <0){LOCAL_COUNTER_TOTAL = 0;}
		adapter.setState('COUNTER_TOTAL',LOCAL_COUNTER_TOTAL,true);
		adapter.log.info ('Subtrcted from COUNTER_TOTAL:' + SUBS);
		return;	
	}
//Send command to all connected Interfaces
	if (id.search ('SEND') >-1)
	{
		var SND = obj.val;
		var WDATA; 
		WDATA= Buffer.from ([83,69,78,68,(SND & 0xFF)]); 
		connectedSockets.broadcast(WDATA);
		return;
	}
});

//Output Control
function AMPELCONTROLLER(){
	var WDATA; 		//AUSGABE am NETZWERK "RED" "YELLOW" "GREEN"
		
	//MODUS ist auf ROT
	if (LOCAL_COUNTER_MODE ==1) {
		WDATA= Buffer.from ([82,69,68]); 	// 'RED'
		connectedSockets.broadcast(WDATA);
		adapter.setState('OUTPUT_STATE',2,true);					//ROT
		return;
	}
	//MODUS ist auf GELB
	if (LOCAL_COUNTER_MODE ==2) {
		WDATA= Buffer.from ([89,69,76,76,79,87]); 	// 'YELLOW'
		connectedSockets.broadcast(WDATA);
		adapter.setState('OUTPUT_STATE',1,true);				//GELB
		return;
	}
	//MODUS ist auf GRÜN
	if (LOCAL_COUNTER_MODE > 2) {
		WDATA= Buffer.from ([71,82,69,69,78]); 	// 'GREEN'
		connectedSockets.broadcast(WDATA);
		adapter.setState('OUTPUT_STATE',0,true);				//GRÜN
		return;
	}
	//MODUS <=0
	//Über LIMIT ROT
	if (LOCAL_COUNTER_TOTAL >= LOCAL_LIMIT_RED){
		WDATA= Buffer.from ([82,69,68]); 	// 'RED'
		connectedSockets.broadcast(WDATA);
		adapter.setState('OUTPUT_STATE',2,true);				//ROT
		return;
	}
	
	//Über LIMIT GELB
	if (LOCAL_COUNTER_TOTAL >= LOCAL_LIMIT_YELLOW){
		WDATA= Buffer.from ([89,69,76,76,79,87]); 	// 'YELLOW'
		connectedSockets.broadcast(WDATA);
		adapter.setState('OUTPUT_STATE',1,true);					//GELB
		return;
	}
	
	//GRÜN
	WDATA= Buffer.from ([71,82,69,69,78]); 	// 'GREEN'
	connectedSockets.broadcast(WDATA);
	adapter.setState('OUTPUT_STATE',0,true);	//GRÜN
	return;
}


