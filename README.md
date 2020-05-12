![Logo](admin/dmxface.png)
http://www.dmxface.at
## ioBroker.dmxface special counting application adapter
DMXface is a programmable IO controller 
Documentation and communication protocoll downloads: 
http://www.spl-technik.at/index.php/dmxface-downloads
 
## DMXface counter adapter for ioBroker
This adapter connects one DMXfaceXP controller with ioBroker.
It uses the trigger an sequence function to receive commands to count a global number up or down, 
check a limit an control multiple instances of this adapter.

## Setup the DMXface
To configure the DMXface controller, you need the 'DMXface Console' downloadable at http://www.dmxface.at
After connecting by USB, you can access and change the controllers setup und network settings as well programm the controller.

## DMXface network settings (Menu: DMXface settings / Network setup)<br>
Here you can configure a valid IP address for the DMXface controller.
To get the DMXface connected to the IO Broker you have as well to setup the socket 6 or 7:
Set it to 'TCP SERVER', 'TRIGGER and SEQUENCE' with a valid PORT (Default e.g. 6000).

## DMXface setup settings (Menu: DMXface settings / Basic setup)<br>
No addtional setup required, commands will be forwarded as "EIN" "AUS" (Sent by DMXface)
and "SEND1" to nn to be captured by a trigger in the dmxface

## Add adapter to ioBroker
Add the DMXface adapter from github  https://github.com/DMXface/ioBroker.dmxfacecount.git
Create an instance of the adapter.

## Adapter configuration
IP address:  Same as used for the DMXfaceXP controller.
Port: various

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