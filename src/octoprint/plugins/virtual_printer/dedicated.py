import threading
import serial
import time

from octoprint import init_settings
from octoprint.plugin import PluginSettings
from octoprint.plugins.virtual_printer import VirtualPrinterPlugin
from octoprint.plugin import plugin_manager

class Seraial2Serial():
	def __init__(self, serial_1, serial_2):
		self._serial = [serial_1, serial_2]
		self._buffer = [[],[]]

		self._read_thread = [None, None]
		self._read_thread[0] = threading.Thread(target=self.read, args=(0, self._serial[0], ))
		self._read_thread[0].daemon = True
		self._read_thread[1] = threading.Thread(target=self.read, args=(1, self._serial[1], ))
		self._read_thread[1].daemon = True

		self._write_thread = [None, None]
		self._write_thread[0] = threading.Thread(target=self.write, args=(0, self._serial[1], ))
		self._write_thread[0].daemon = True
		self._write_thread[1] = threading.Thread(target=self.write, args=(1, self._serial[0], ))
		self._write_thread[1].daemon = True

		self._read_thread[0].start()
		self._read_thread[1].start()

		self._write_thread[0].start()
		self._write_thread[1].start()

	def read(self, id_from, serial_from):
		while True:
			data = serial_from.readline()
			if data:
				data += b"\r\n"
				self._buffer[id_from].append(data)

	def write(self, id_from, serial_to):
		while True:
			if len(self._buffer[id_from]) > 0:
				data = self._buffer[id_from].pop(0)
				serial_to.write(data)


settings = init_settings('/home/shawn/src/OctoPrint/.octoprint', '/home/shawn/src/OctoPrint/.octoprint/config.yaml')

pluginmanager = plugin_manager(init=True)

virtualprinter_plugin = VirtualPrinterPlugin()
virtualprinter_plugin._settings = PluginSettings(settings, 'virtualprinter')

virtualprinter_serialobj = virtualprinter_plugin.virtual_printer_factory(None, 'VIRTUAL', None, 1)


serialobj = serial.Serial(port='/dev/ttyUSB1', baudrate=115200, write_timeout=0, timeout=1)

s2s = Seraial2Serial(virtualprinter_serialobj, serialobj)

while True:
	time.sleep(1)


