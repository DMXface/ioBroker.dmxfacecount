'use strict';
//DMXfaceXP Adapter for ioBroker
//Uses DMXface ACTIVE SEND PROTOCOLL Rev 5.14 to communicate (Documentation available www.dmxface.at)
const utils = require('@iobroker/adapter-core');
var adapter  = utils.Adapter ('dmxface');

var LOG_ALL = true;

// DMXFACE CONNECTION value containers
var IPADR  = "0.0.0.0";
var PORT = 0;
var TIMING = 1000;
var DMX_CHANNELS_USED = 0;

//To receive analog values of inports, businports and dmxchannels (optional converted by tables @dmxface) 
//the required ports have to be specified with a string containing INnn, BUSnn or DMXnn 
//The listed ports are requested with the specified cycle time one by one.
var EX_REQUEST_LIST = "IN1,IN2,IN3,IN4,BUS1,BUS2,BUS3,DMX4,DMX3,DMX6";  //Setup List to be forwarded by html
var EX_REQUEST_NAMES = [];  	// ['VALUE_IN1'],[VALUE_IN2] ...formatted and checked eqivalent to OBJECT NAMES
var EX_REQUEST_PORTS ="";  		// String "IIIIBBBDDD" each postion I,B,D equvalent to list
var EX_REQUEST_NUMBERS =[];		// [1],[2],[3] ...  Portnumber 1 to nn integer 
var EX_PTR = 0;  //Pointer to the Object requested next

// OBJECT ID of TIMED DATA REQUEST
var OBJID_REQUEST; 

// DMXface TCP Connection
var net = require ('net');
var client = new net.Socket();

// CHECK FLAG true when connection established and free of error
var IS_ONLINE  = false;

adapter.on ('ready',function (){
	var i;
//Move the ioBroker Adapter configuration to the container values 
	IPADR = adapter.config.ipaddress;
	PORT = adapter.config.port;
	TIMING = adapter.config.requesttiming; 
	DMX_CHANNELS_USED = parseInt(adapter.config.lastdmxchannel);

//LIMIT the number of DMX channels max. 224 usable with ioBroker
	if (DMX_CHANNELS_USED >224) {DMX_CHANNELS_USED = 224};
	if (DMX_CHANNELS_USED <0) {DMX_CHANNELS_USED = 0};
//LIMIT the request timimng	
	if (TIMING <100){TIMING = 100;}
	if (TIMING > 3600000) {TIMING = 3600000;}
	
	adapter.log.info ('Connecting DMXface ' +IPADR + ' Port:' + PORT + '  Timing:' + TIMING + 'ms  DMXchannels:' + DMX_CHANNELS_USED);

//Read and check the user configurable string containig additional ports that will by requested by ioBroker
	EX_REQUEST_LIST = EX_REQUEST_LIST.trim();				//Remove blanks
	if (EX_REQUEST_LIST.length > 0){						//Check for content
		EX_REQUEST_LIST = EX_REQUEST_LIST.toUpperCase();		//Uppercase "IN1,IN3,BUS4,..."
		var BUFF = EX_REQUEST_LIST.split(",");					//Split the content seperated by ","

		for (i=0; i<BUFF.length; i++){							//Check the elements vor valid entries and add to list 
			var BB = BUFF[i];
			switch (BB[0]){										//Check first character and Port number 
				case 'I':		//INPORT valid from 1 to 16
					var PNR = parseInt(BUFF[i].substring(2));   // e.g. "IN10" --> Position 2++ has to contain Portnumber
					if (PNR >0 && PNR <17) {					//VALID INPORT NUMBER 1 to 16
						EX_REQUEST_PORTS += 'I';				//ADD Element to String
						EX_REQUEST_NUMBERS.push (PNR);
						EX_REQUEST_NAMES.push ('VALUE_' + GetIN(PNR));
						if (LOG_ALL) {adapter.log.info ("String entry, create State:" + EX_REQUEST_NAMES[EX_REQUEST_NAMES.length -1])}
					}
					break;
				case 'B':   //BUS Port valid from 1 to 32
					var PNR = parseInt(BUFF[i].substring(3));   // e.g. "BUS24" -> Position 3++ has to contain Portnumber
					if (PNR >0 && PNR <33) {					//VALID INPORT NUMBER 1 to 32
						EX_REQUEST_PORTS += 'B';				//ADD Element to list
						EX_REQUEST_NUMBERS.push (PNR);
						EX_REQUEST_NAMES.push ('VALUE_' + GetBUS(PNR));
						if (LOG_ALL) {adapter.log.info ("String entry, create State:" + EX_REQUEST_NAMES[EX_REQUEST_NAMES.length -1])}
					}
					break;
				case 'D':   //DMX valiud from 1 to 224
					var PNR = parseInt(BUFF[i].substring(3));   // e.g. "DMX221" -> Position 3++ has to contain Portnumber
					if (PNR >0 && PNR <225) {					//VALID DMX NUMBER 1 to 224
						EX_REQUEST_PORTS += 'D';				//ADD Element to list
						EX_REQUEST_NUMBERS.push (PNR);
						EX_REQUEST_NAMES.push ('VALUE_' + GetDMX(PNR));
						if (LOG_ALL) {adapter.log.info ("String entry, create State:" + EX_REQUEST_NAMES[EX_REQUEST_NAMES.length -1])}
					}
					break;
				default:
					break;
			}
		}
	}
						
	
//Initialize tioBrokers state objects if they dont exist
//DMX CHANNELS contain and send DMX value 0-255 to a DMX channel
	for (i=1;i<=DMX_CHANNELS_USED;i++){
		adapter.setObjectNotExists (GetDMX(i),{
			type:'state',
			common:{name:'DMX channel'+i ,type:'number',role:'value',read:true,write:true},
			native:{}
		});
	}
//OUTPORTS contain and send outport value true or false to a outport
	for (i=1;i<=16;i++){
		adapter.setObjectNotExists (GetOUT(i),{
			type:'state',
			common:{name:'OUTPORT'+i,type:'boolean',role:'value',read:true,write:true},
			native:{}
		});		
	}
//INPORTS contain the bool value of an inport
	for (i=1;i<=16;i++){
		adapter.setObjectNotExists (GetIN(i),{
			type:'state',
			common:{name:'INPORT'+i,type:'boolean',role:'value',read:true,write:false},
			native:{}
		});		
	}
		
//IR REMOTE RECEIVE contains the HEX string of the last received IR CODFE (DMXface format 8 Bytes)
	adapter.setObjectNotExists ('IR_RECEIVE',{
		type:'state',
		common:{name:'IR REMOTE RECEIVE',type:'string',role:'value',read:true,write:false},
		native:{}
	});		
		
//SCENEN calls a scene when scene number is written to the object value 
	adapter.setObjectNotExists ('SCENE_CALL',{
		type:'state',
		common:{name:'SCENE NUMBER CALL',type:'number',role:'value',read:true,write:false},
		native:{}
	});		
		
//PROGRAM calls a program when program number is written to the object value 
	adapter.setObjectNotExists ('PROGRAM_CALL',{
		type:'state',
		common:{name:'PROGRAM NUMBER CALL',type:'number',role:'value',read:true,write:false},
		native:{}
	});		
		
//BUS_INPORTS contain and send bus port value true or false to a bus Port 1-32
	for (i=1;i<=32;i++){
		adapter.setObjectNotExists (GetBUS(i),{
			type:'state',
			common:{name:'BUS IO'+i,type:'boolean',role:'value',read:true,write:true},
			native:{}
		});		
	}
		
//User specific requests of addtional port values, create one object for each value
	for (i=0; i < EX_REQUEST_NAMES.length; i++){
		adapter.setObjectNotExists (EX_REQUEST_NAMES[i],{
			type:'state',
			common:{name: EX_REQUEST_NAMES,type:'number',role:'value',read:true,write:false},
			native:{}
		});		
	}

//Enable receiving of change events for all objects
	adapter.subscribeStates('*');

// Connect the DMXface server (function below)
	CONNECT_CLIENT();
//INITIATE timed request for additional requests if list contains valid ports
	if (EX_REQUEST_NAMES.length > 0) {
		OBJID_REQUEST = setInterval (CLIENT_REQUEST,TIMING);
		adapter.log.info ("Starting timed port request:" + EX_REQUEST_NAMES.length +" Ports," + TIMING + "ms")
	}
});

// Adapter termination by IObroker
adapter.on ('unload',function (callback){
	adapter.log.info ('DMXface: Close connection, cancel service');
	clearInterval (OBJID_REQUEST);
	CLIENT.close;
	callback;
	});


//State Changes	
adapter.on ('stateChange',function (id,obj){
	if (obj.from.search ('dmxface') != -1) {return;}    // do not process self generated state changes (by dmxface instance) 
														//exit if sender = dmxface
	var PORTSTRING = id.substring(10);  				//remove Instance name
	// if (PORTSTRING[0] ='.'){PORTSTRING = id.substring(11);  optional removal if more than 10 Instances are used 
	
	//Select the object type by the first character of the object name
	//'O' OUTPORT , 'D' DMX, 'B' BUSINPORT   , INPORT and IR_RECEIVE cannot be set 
	var PORTNUMBER =-1
	var WDATA 
	switch (PORTSTRING[0]) {
		case 'O':		//OUTPORT
			var PORTNUMBER = parseInt(PORTSTRING.substring(7));
			WDATA= Buffer.from ([0xF0,0x4F,(PORTNUMBER & 0xFF),0]);  // DMXFACE ACTIVE SEND Command switch Portnumber to OFF
			if (obj.val ==true) {WDATA[3] = 1;}						// IF TRUE then ON 
			client.write (WDATA); 
			break;
			
		case 'D':		//DMX CHANNEL
			var PORTNUMBER = parseInt(PORTSTRING.substring(3));
			WDATA= Buffer.from ([0xF0,0x44,0x00,(PORTNUMBER &0xFF),obj.val]);  // DMXFACE ACTIVE SEND Command SET DMX CHANNEL
			client.write (WDATA); 
			break;
		case 'B':	 	//BUS IO 
			var PORTNUMBER = parseInt(PORTSTRING.substring(3));
			PORTNUMBER+=24;
			WDATA= Buffer.from ([0xF0,0x4F,(PORTNUMBER & 0xFF),0]);  // DMXFACE ACTIVE SEND BUS IO
			if (obj.val ==true) {WDATA[3] = 1;}						// IF TRUE then ON 
			client.write (WDATA); 
			break;
		case 'S':  		//SCENE CALLED by the change of the object value 
			var SCENE_NUMBER = obj.val;
			if (SCENE_NUMBER < 1){return;}
			if (SCENE_NUMBER > 180){return;}
			WDATA= Buffer.from ([0xF0,0x53,SCENE_NUMBER]);  // DMXFACE ACTIVE SEND BUS IO
			client.write (WDATA); 
			break;
		
		case 'P':  		//PROGRAM CALLED by the change of the object value   
			var PG_NUMBER = obj.val;
			if (PG_NUMBER < 1){return;}
			if (PG_NUMBER > 28){return;}
			WDATA= Buffer.from ([0xF0,0x50,PG_NUMBER]);  // DMXFACE ACTIVE SEND BUS IO
			client.write (WDATA); 
			break;
		default:
			return;
			break;
	}
});


//Connect the client
function CONNECT_CLIENT () {
	if (LOG_ALL){adapter.log.info('DMXface CONNECTING')};
	IS_ONLINE = false;
	client.close;
	client.connect (PORT,IPADR,CBclientCONNECT);
}

//CLIENT CONNECTED callback
function CBclientCONNECT () {
	// Handler
	client.on ('data',CBclientRECEIVE);
	client.on ('error',CBclientERROR);
	adapter.setState ('info.connection',true,true);
	adapter.log.info ('DMXface connection established');
	// ONLINE FLAG
	IS_ONLINE = true;
}

	
//Request of addition listet Inports Bus Ports or MDX Channels with Conversions
function CLIENT_REQUEST	(){
	if (IS_ONLINE = true) {
		if (EX_PTR >= EX_REQUEST_NAMES.length){EX_PTR =0;}   //RESET the POINTER if > array.length
		if (LOG_ALL) {adapter.log.info ("Request:" +EX_REQUEST_NAMES[EX_PTR])}
		var WDATA; 				//TX Buffer
		switch (EX_REQUEST_PORTS[EX_PTR]) {		//Position contains 'I' / 'B' / 'D' Inport , Bus, DMX
			
			case 'I':		//INPORT 1-24, create Request Command
				WDATA= Buffer.from ([0xF0,0x49,0x00,(EX_REQUEST_NUMBERS[EX_PTR] & 0xFF)]);
				client.write (WDATA); 
				break;
			
			case 'B':		//BUS 1-32
				var PNR = (EX_REQUEST_NUMBERS[EX_PTR] +24)//OFFSET BUS same Command but Numbers 25 to 56
				WDATA= Buffer.from ([0xF0,0x49,0x00,PNR]);
				client.write (WDATA); 
				break;
			
			case 'D':		//DMX 1-224
				var PNR = (EX_REQUEST_NUMBERS[EX_PTR] +256)//OFFSET DMX =256 --> 0x0101 to 0x320 max
				WDATA= Buffer.from ([0xF0,0x49,((PNR >> 8) & 0xFF),(PNR & 0xFF)]);
				client.write (WDATA); 
				break;
			
			default:
				return;
				break;
		}
		EX_PTR+=1;    //next pointer 
	}
}

//CLIENT ERROR HANDLER
function CBclientERROR(Error) {
	IS_ONLINE = false;
	adapter.log.error ("DMXface connection error: " + Error);
	adapter.log.info ("Reconnecting");
	CONNECT_CLIENT;
}



//------------------------------------------------------ RX DATA PROCESSING --------------------------------------------------------------------
// Prozessing the received ACTIVE SEND data from DMXface 
function CBclientRECEIVE(RXdata) {
	if (RXdata.length < 3) {return;}			// Minimum Length of response ist start 0xF0, Signature 0xnn and at least one data byte 
	
	if (RXdata[0] != 0xF0) {					// CHECK START BYTE =0xF0
		return;
	}
	var i;
	var x;	
	
	switch (RXdata[1]) {
		case 0x01:			// IR CODE 10 Bytes received, 8 Bytes IR Code
			if (RXdata.length == 10){    
				var BUFF = "";
				var IRCODE = "";
				for (i=2;i<10;i++){
					BUFF = RXdata[i].toString(16).toUpperCase();
					//BUFF = BUFF.toUpperCase;
					if (BUFF.length <2) {IRCODE += '0'+BUFF} else {IRCODE += BUFF}
				}
				adapter.setState('IR_RECEIVE',IRCODE,false);
			}
			
			break;

		case 0x02:   		//RECEIVING INPORT STATE INFO //9 Bytes RX length
			if (RXdata.length == 9){    
				var ONOFF = false;
				x =1;
				for (i=1;i<0x81;i*=2){
					if (i & RXdata[8]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetIN(x),ONOFF);
					if (i & RXdata[7]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetIN(x+8),ONOFF);
					//if (i & RXdata[6]){ONOFF = true;} else {ONOFF = false;}
					//adapter.setState(GetIN(x+16),ONOFF);
					if (i & RXdata[5]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetBUS(x),ONOFF);
					if (i & RXdata[4]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetBUS(x+8),ONOFF);
					if (i & RXdata[3]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetBUS(x+16),ONOFF);
					if (i & RXdata[2]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetBUS(x+24),ONOFF);
					x+=1;
				}
			}
			break;
		
		case 0x04:	//OUTPORT  //5 Bytes RX length
			var ONOFF = false;
			if (RXdata.length == 5){   
				x =1;
				for (i=1;i<0x81;i*=2){
					if (i & RXdata[4]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetOUT(x),ONOFF);
					if (i & RXdata[3]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetOUT(x+8),ONOFF);
					x+=1;
				}
			}
			break;
		
		case 0x49: //AD INPORT REQUEST RETURN  0xF0,0x49,PORTNR_HIGH,PORTNR LOW , bDIGITAL VALUE, bANALOG VALUE, 'TEXT VALUE eg. 34.55 GRAD'
			//EXTRACT PORT and Float value, write it to the coreesponding object if exists
			if (RXdata.length > 8){   
				var exFLOAT = 0;				//Resulting float Value 
				var exNUMBER = (RXdata[2]*256)+ RXdata[3]		//PORT NUMBER  1-24 INPORTS 1-24
																//25-56 BUS 1-32
				var exPORTS = '';							    //0x101-0x320 DMX 1-544
				var exNAME ='';
				if (exNUMBER > 0 && exNUMBER <=24) {				
					exPORTS ='I';							// INPORT
					exNAME = "VALUE_" + GetIN(exNUMBER);	// OBJECT NAME
				}
				if (exNUMBER >=25 && exNUMBER <=56) {				
					exNUMBER-=24;							// REMOVE OFFSET
					exPORTS ='B';							// BUS PORT
					exNAME = "VALUE_" + GetBUS(exNUMBER);	// OBJECT NAME
				}
				if (exNUMBER >=257 && exNUMBER <=481) {				
					exNUMBER-=256;							// REMOVE OFFSET
					exPORTS ='D';							// BUS PORT
					exNAME = "VALUE_" + GetDMX(exNUMBER);	// OBJECT NAME
				}
				if (exNAME.length==0){return;}				//EXIT if portnumber not applicable
				// get the value string out of RX from pos 6++	
				var strVALUE='';			
				for (i=6;i< RXdata.length;i++){
					strVALUE+=String.fromCharCode (RXdata[i]);
					}	
				//Replace "," to "." and convert to float
				exFLOAT = parseFloat (strVALUE.replace (",","."));
				//Transfer to OBJECT
				if (LOG_ALL){adapter.log.info ("RX: " + exNAME + " DATA:" + exFLOAT)};
				adapter.setState(exNAME,exFLOAT);
			}
			break;
		
		case 0xFF:	//DMX OUT DATA
			var USED_DXMOUT = (RXdata.length-2);
			if (DMX_CHANNELS_USED < USED_DXMOUT) {
				USED_DXMOUT = DMX_CHANNELS_USED;
				}
			
			for (i=1;i <= USED_DXMOUT;i++){
				adapter.setState(GetDMX(i),RXdata[i+1]);				
				}
			break;
			
			
		default:
			return;
			break;
	}

	
}


function GetDMX (number){
	if (number <10) {return 'DMX00'+number;}
	if (number <100) {return 'DMX0'+number;}
	return 'DMX'+number;
}
function GetOUT (number){
	if (number <10) {return 'OUTPORT0'+number;}
	return 'OUTPORT'+number;
}
function GetIN (number){
	if (number <10) {return 'INPORT0'+number;}
	return 'INPORT'+number;
}
function GetBUS (number){
	if (number <10) {return 'BUS0'+number;}
	return 'BUS'+number;
}
