if __name__ == "__main__":
	import serial
	import time

	from octoprint import init_settings
	from octoprint.plugin import PluginSettings
	from octoprint.plugins.virtual_printer import VirtualPrinterPlugin
	from octoprint.plugin import plugin_manager


	_settings = init_settings('/home/shawn/src/OctoPrint/.octoprint', '/home/shawn/src/OctoPrint/.octoprint/config.yaml')
	_plugin_manager = plugin_manager(init=True)

	_plugin = VirtualPrinterPlugin()
	_plugin._settings = PluginSettings(_settings, 'virtualprinter')

	_virtual_serial = _plugin.virtual_printer_factory(None, 'VIRTUAL', None, _settings.getFloat(["serial", "timeout", "connection"]))



    try:
		_serial = serial.Serial(port='/dev/ttyUSB1', baudrate=115200, write_timeout=0, timeout=1)
        _serial.flushInput()
    except (IOError, serial.SerialException) as e:
        print "\nCOM Port [", SERIALPORT2, "] not found, exiting...\n"
        exit(1)

    try:
        while 1:
            ser1_waiting = ser1.inWaiting()
            if ser1_waiting > 0:
                #rx1 = ser1.read(ser1_waiting)
                rx1 = ser1.readline()
                rx1 += "\r\n"
                ser2.write(rx1)
                print rx1
            ser2_waiting = ser2.inWaiting()
            if ser2_waiting > 0:
                #rx2 = ser2.read(ser2_waiting)
                rx2 = ser2.readline()
                rx2 += "\r\n"
                ser1.write(rx2)
                print rx2
    except IOError:
        print "Some IO Error found, exiting..."
