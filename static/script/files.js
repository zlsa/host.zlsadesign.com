
const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

function prettyBytes(num) {
	if (!Number.isFinite(num)) {
		throw new TypeError(`Expected a finite number, got ${typeof num}: ${num}`);
	}

	const neg = num < 0;

	if (neg) {
		num = -num;
	}

	if (num < 1) {
		return (neg ? '-' : '') + num + ' B';
	}

	const exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), UNITS.length - 1);
	const numStr = Number((num / Math.pow(1000, exponent)).toPrecision(3));
	const unit = UNITS[exponent];

	return (neg ? '-' : '') + numStr + ' ' + unit;
}

var max_size = 50 * 1000 * 1000;

function handleFilesChanged() {
  $('.files tbody').empty();
  
  for(var i=0; i<this.files.length; i++) {
    addFile(this.files[i]);
  }
}

function attachListeners() {
  $('#file-upload')[0].addEventListener('change', handleFilesChanged, false);
}

function addFile(file) {
  var status = 'ok';
  var message = 'ready';

  console.log(file);

  var tr = $('<tr></tr>');

  if(file.size > max_size) {
    status = 'error';
    message = 'file too large';
  }
  
  tr.addClass(status);

  var name_el = $('<td></td>');
  name_el.text(file.name);

  var size_el = $('<td class="size"></td>');
  size_el.text(prettyBytes(file.size));

  var message_el = $('<td class="message"></td>');
  message_el.text(message);

  tr.append(name_el);
  tr.append(size_el);
  tr.append(message_el);

  $('.files tbody').append(tr);
}

$(document).ready(function() {
  attachListeners();
});
