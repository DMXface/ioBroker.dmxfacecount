![Logo](admin/dmxface.png)
http://www.dmxface.at
## ioBroker.dmxface server adapter for counting applications
DMXface is a programmable IO controller 
Documentation and communication protocoll downloads: 
http://www.spl-technik.at/index.php/dmxface-downloads
 
## DMXface counter server adapter for ioBroker
This adapter connects multiple DMXfaceXP controller with ioBroker.
It acts as TCP Server listening to a configurable port.
From each DMXface connected commands are received:
"EIN" add +1 to the COUNTER_TOTAL state
"AUS" sub -1 from the COUNTER_TOTAL state

The OUTPUT_STATE shows the current output value 
0--> GREEN
1--> YELLOW
2--> RED

The COUNTER_MODE state defines the current function 
COUNTER_MODE = 1 --> OUTPUT will stay on RED(2) all the time
COUNTER_MODE = 2 --> OUTPUT will stay on Yellow(1) all the time
COUNTER_MODE = 3 --> OUTPUT will stay on Green(0) all the time

COUNTER_MODE =0 --> Output is controlled by the COUNTER_TOTAL and LIMIT_RED/YELLOW states
If the COUNTER_TOTAL value achieves the LIMIT_RED the Adapter sends "RED" to all clients connected 
If the COUNTER_TOTAL value achieves the LIMIT_YELLOW the Adapter sends "YELLOW" to all clients connected 
other case it sends "GREEN" to all clients connected


## Setup the DMXface
To configure the DMXface controller, you need the 'DMXface Console' downloadable at http://www.dmxface.at
After connecting by USB, you can access and change the controllers setup und network settings as well programm the controller.

## DMXface network settings (Menu: DMXface settings / Network setup)<br>
Here you need to configure a TCP_CLIENT with the IP address of ioBroker and the Port used with the adapter.
Use 'TRIGGER and SEQUENCE' mode to send an receive commands

## Add adapter to ioBroker
Add the DMXface adapter from github  https://github.com/DMXface/ioBroker.dmxfacecount.git
Create an instance of the adapter.

## Adapter configuration
Port: Same as configured with the communication socket for ioBroker at the DMXface 

## 1.1.0
released for use with DMXfaceXP Controller

##  Changelog
1.0.0  Initial release<br>

## License
MIT License<br>

Copyright (c) 2020 SPaL Oliver Hufnagl <mail@dmxface.at><br>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.