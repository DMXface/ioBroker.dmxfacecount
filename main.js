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
//Spiegelung der States nach Lokal
var LOCAL_COUNTER_TOTAL = 0;
var LOCAL_LIMIT_RED = 0;  
var LOCAL_LIMIT_YELLOW = 0;
var LOCAL_COUNTER_MODE = 0;

//*************************************  ADAPTER STARTS with ioBroker *******************************************
adapter.on ('ready',function (){
	var i;
//Move the ioBroker Adapter configuration to the container values 
	IPADR = adapter.config.ipaddress;
	PORT = adapter.config.port;
	LOG_ALL = adapter.config.extlogging;
	
	adapter.log.info ("DMXfaceXP " + IPADR + " Port:" + PORT);


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


//calls sent to LANPORT --> Trigger
	adapter.setObjectNotExists ('SEND',{
		type:'state',
		common:{name:'SENDtoDMXface',type:'number',role:'value',read:true,write:true},
		native:{}
	});		
		

//lokale Pramter abfragen
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
	adapter.log.info ('Object: '+ id + ' VAL:' + obj.val);
	
//WENN SICH EIN STATE LIMIT,WARNING oder COUNTER ändert die lokale Variable mitziehen
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
														  //exit if sender = dmxface
	var PORTSTRING = id.substring(adaptername.length+3);  				//remove Instance name
	// if (PORTSTRING[0] ='.'){PORTSTRING = id.substring(adaptername.length+4)};  optional removal if more than 10 Instances are used 
	//Statistic value´s are not processed
	//Reset of min max 
	if (PORTSTRING.search ('FNKTN_RESET') >-1)
	{
		adapter.setState('COUNTER_TOTAL',0,true);
		adapter.setState(ID,false,true);
		adapter.log.info ('COUNTER_TOTAL: RESET');
		return;	
	}

	if (PORTSTRING.search ('FNKTN_ADD') >-1)
	{
		var ADDS = obj.val;
		if (ADDS <= 0){return;}
		LOCAL_COUNTER_TOTAL+=ADDS;
		adapter.setState('COUNTER_TOTAL',LOCAL_COUNTER_TOTAL,true);
		adapter.log.info ('Added to COUNTER_TOTAL:' + ADDS);
		return;	
	}
	
	if (PORTSTRING.search ('FNKTN_SUB') >-1)
	{
		var SUBS = obj.val;
		if (SUBS <= 0){return;}
		LOCAL_COUNTER_TOTAL-=SUBS;
		if (LOCAL_COUNTER_TOTAL <0){LOCAL_COUNTER_TOTAL = 0;}
		adapter.setState('COUNTER_TOTAL',LOCAL_COUNTER_TOTAL,true);
		adapter.log.info ('Subtrcted from COUNTER_TOTAL:' + SUBS);
		return;	
	}

	if (PORTSTRING.search ('SEND') >-1)
	{
		var SND = obj.val;
		var WDATA; 
		WDATA= Buffer.from ([83,69,78,68,(SND & 0xFF)]); 
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
	AMPELCONTROLLER();  //Ampel Status setzen
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
	var DELTA=0;
	if (RXdata[0] == 69) {DELTA = 1;}		//EIN
	if (RXdata[0] == 65) {DELTA = -1;}	    //AUS
											//RESET--> R
											//+1 --> P
											//-1 --> M 
											
	if (DELTA ==0) {return;}
	LOCAL_COUNTER_TOTAL+=DELTA;
	if (LOCAL_COUNTER_TOTAL <0){LOCAL_COUNTER_TOTAL=0};
	adapter.setState('COUNTER_TOTAL',LOCAL_COUNTER_TOTAL,true);
	if (LOG_ALL) {adapter.log.info ('Received DELTA:' + DELTA + '  COUNTER_TOTAL' +LOCAL_COUNTER_TOTAL)};
}



//STEUERUNG DES AMPEL STATUS 
function AMPELCONTROLLER(){
	var WDATA; 		//AUSGABE am NETZWERK "RED" "YELLOW" "GREEN"
		
	//MODUS ist auf ROT
	if (LOCAL_COUNTER_MODE ==1) {
		WDATA= Buffer.from ([82,69,68]); 	// 'RED'
		client.write (WDATA);
		adapter.setState('OUTPUT_STATE',2,true);					//ROT
		return;
	}
	//MODUS ist auf GELB
	if (LOCAL_COUNTER_MODE ==2) {
		WDATA= Buffer.from ([89,69,76,76,79,87]); 	// 'YELLOW'
		client.write (WDATA);
		adapter.setState('OUTPUT_STATE',1,true);				//GELB
		return;
	}
	//MODUS ist auf GRÜN
	if (LOCAL_COUNTER_MODE > 2) {
		WDATA= Buffer.from ([71,82,69,69,78]); 	// 'GREEN'
		client.write (WDATA);
		adapter.setState('OUTPUT_STATE',0,true);				//GRÜN
		return;
	}
	//MODUS <=0
	//Über LIMIT ROT
	if (LOCAL_COUNTER_TOTAL >= LOCAL_LIMIT_RED){
		WDATA= Buffer.from ([82,69,68]); 	// 'RED'
		client.write (WDATA);
		adapter.setState('OUTPUT_STATE',2,true);				//ROT
		return;
	}
	
	//Über LIMIT GELB
	if (LOCAL_COUNTER_TOTAL >= LOCAL_LIMIT_YELLOW){
		WDATA= Buffer.from ([89,69,76,76,79,87]); 	// 'YELLOW'
		client.write (WDATA);
		adapter.setState('OUTPUT_STATE',1,true);					//GELB
		return;
	}
	
	//GRÜN
	WDATA= Buffer.from ([71,82,69,69,78]); 	// 'GREEN'
	client.write (WDATA);
	adapter.setState('OUTPUT_STATE',0,true);	//GRÜN
	return;
}


