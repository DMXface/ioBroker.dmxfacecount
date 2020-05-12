'use strict';
//DMXfaceXP Adapter for counter application with ioBroker
//REV 1.0.0

const adaptername = "dmxfacecount"

const utils = require('@iobroker/adapter-core');
var adapter  = utils.Adapter (adaptername);

var LOG_ALL = false;						//Flag to activate full logging

//DMXFACE CONNECTION values
var IPADR  = "0.0.0.0";						//DMXface IP address
var PORT = 0;								//DMXface port of TCP server ACIVE SEND socket (Configured @ DMXface Setup)
var TIMING = 1000;							//Request timing for addtional added ports and analog inputs
var DMX_CHANNELS_USED = 0;					//DMXchannels in use by ioBroker to prevent getting objects for all 244 channels

// DMXface TCP Connection
var net = require ('net');
var client = new net.Socket();

	// Handler
	client.on ('data',CBclientRECEIVE);
	client.on ('error',CBclientERROR);
	client.on ('close',CBclientCLOSED);
	client.on ('ready',CBclientCONNECT);
var APPLICATIONstopp = false;		//FLAG that shows that a reconnect process is runnig, after an error has occured.

//FLAG, true when connection established and free of error
var IS_ONLINE  = false;

var CURRENT_LIMIT = 0;  //NOCH NICHT ABGEFRAGT
var CURRENT_WARNING = 0;


//*************************************  ADAPTER STARTS with ioBroker *******************************************
adapter.on ('ready',function (){
	var i;
//Move the ioBroker Adapter configuration to the container values 
	IPADR = adapter.config.ipaddress;
	PORT = adapter.config.port;
	LOG_ALL = adapter.config.extlogging;
	
	adapter.log.info ("DMXfaceXP " + IPADR + " Port:" + PORT);


//Initialize ioBrokers state objects if they dont exist

	adapter.setObjectNotExists ("LIMIT",{
		type:'state',
			common:{name:'LIMIT',type:'number',role:'value',read:true,write:true},
			native:{}
		});	
	adapter.setObjectNotExists ("WARNING",{
		type:'state',
			common:{name:'WARNING',type:'number',role:'value',read:true,write:true},
			native:{}
		});	
	adapter.setObjectNotExists ("COUNTER",{
		type:'state',
			common:{name:'COUNTER',type:'number',role:'value',read:true,write:true},
			native:{}
		});		

	adapter.setObjectNotExists ("COUNTER_ADD",{
		type:'state',
			common:{name:'COUNTER_ADD',type:'number',role:'value',read:true,write:true},
			native:{}
		});		
	
	adapter.setObjectNotExists ("COUNTER_SUB",{
		type:'state',
			common:{name:'COUNTER_SUB',type:'number',role:'value',read:true,write:true},
			native:{}
		});	
		
	adapter.setObjectNotExists ("COUNTER_RESET",{
		type:'state',
			common:{name:'COUNTER_RESET',type:'boolean',role:'value',read:true,write:true},
			native:{}
		});	
		
//calls sent to LANPORT --> Trigger
	adapter.setObjectNotExists ('SEND',{
		type:'state',
		common:{name:'SENDtoDMXface',type:'number',role:'value',read:true,write:true},
		native:{}
	});		
		

//Enable receiving of change events for all objects
	adapter.subscribeStates('*');

// Connect the DMXface server (function below)
	CONNECT_CLIENT();


});

//************************************* ADAPTER CLOSED BY ioBroker *****************************************
adapter.on ('unload',function (callback){
	APPLICATIONstopp = true
	IS_ONLINE = false;
	adapter.log.info ('DMXface: Close connection, cancel service');
	client.close;
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
		
	if (obj.from.search (adaptername) != -1) {return;}    // do not process self generated state changes (by dmxface instance) 
														  //exit if sender = dmxface
	var PORTSTRING = id.substring(adaptername.length+3);  				//remove Instance name
	// if (PORTSTRING[0] ='.'){PORTSTRING = id.substring(adaptername.length+4)};  optional removal if more than 10 Instances are used 
	//Statistic value´s are not processed
	//Reset of min max 
	if (PORTSTRING.search ('COUNTER_RESET') >-1)
	{
		adapter.setState('COUNTER',0,true);
		adapter.setState(ID,false,true);
		adapter.log.info ('COUNTER: RESET');
		return;	
	}

	if (PORTSTRING.search ('COUNTER_ADD') >-1)
	{
		var ADDS = obj.val;
		if (ADDS = 0){return;)
		adapter.getState('COUNTER' , function (err, state) {	//get current counter value
			var newVAL =0;
			if (state !=null) {							//EXIT if state is not initialized yet
				if (state.val !=null) {					//Exit if value not initialized
					newVAL= state.val;
				}
			}
			adapter.setState('COUNTER',ADDS+newVAL,true);
			adapter.log.info ('COUNTER:' + ADDS);
		});
		return;	
	}
	
	if (PORTSTRING.search ('COUNTER_SUB') >-1)
	{
		var SUBS = obj.val;
		if (SUBS = 0){return;)
		adapter.getState('COUNTER' , function (err, state) {	//get current counter value
			var newVAL =0;
			if (state !=null) {							//EXIT if state is not initialized yet
				if (state.val !=null) {					//Exit if value not initialized
					newVAL= state.val;
				}
			}
			adapter.setState('COUNTER',newVAL-SUBS,true);
			adapter.log.info ('COUNTER:' + SUBS);
		});
		return;	
	}

	if (PORTSTRING.search ('SEND') >-1)
	{
		var SND = obj.val;
		var WDATA; 
		WDATA= Buffer.from ([0x73,0x65,0x6E,0x64,(SND & 0xFF)]); 
		client.write (WDATA);
		return;
	}
});


//************************************* TCP CONNECT /ERROR / CLOSED ****************************************
function CONNECT_CLIENT () {
	IS_ONLINE = false;
	adapter.log.info("Connecting DMXface controller " + IPADR + " "+ PORT);
	client.connect (PORT,IPADR);
}

//CLIENT SUCCESSFUL CONNECTED (CALLBACK from CONNECT_CLIENT)
function CBclientCONNECT () {
	//adapter.setState ('info.connection',true,true);
	adapter.log.info ('DMXface connection established');
	IS_ONLINE = true;
}

//CLIENT ERROR HANDLER AND CONNECTION RESTART
function CBclientERROR(Error) {
	IS_ONLINE = false;											//Flag Connection not longer online
	adapter.log.error ("Error DMXface connection: " + Error);	
	client.close;												//Close the connection
}
function CBclientCLOSED() {
	adapter.log.warn ("DMXface connection closed");
	if (APPLICATIONstopp ==false) {
		var RCTASK = setTimeout (CONNECT_CLIENT,30000);			//within 30 Sec.
		adapter.log.info ("Trying to reconnect in 30sec.");
	}
		
}

//************************************* PROCESSING ASYNCHRON RECEIVED DATA FROM DMXface ******************************************
function CBclientRECEIVE(RXdata) {
	if (RXdata.length != 3) {return;}			// Minimum Length of response ist start 0xF0, Signature 0xnn and at least one data byte 
	var DELTA;
	if (RXdata[0] == 0x65) {DELTA = 1;}		//EIN
	if (RXdata[0] == 0x61) {DELTA = -1;}	//AUS
	adapter.log.info ('Received DELTA:' + DELTA);
	
	adapter.getState('COUNTER' , function (err, state) {	//get current counter value
		var newVAL =0;
		if (state !=null) {							//EXIT if state is not initialized yet
			if (state.val !=null) {					//Exit if value not initialized
				newVAL= state.val;
			}
		}
		newVAL+= DELTA;
		adapter.setState('COUNTER',newVAL,true);
	});

}


