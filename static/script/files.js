function s(n, singular, plural) {
  if(singular === undefined) singular = '';
  if(plural === undefined) plural = 's';

  if(n === 1) return singular;
  return plural;
};

function prettyBytes(num) {
	if(!Number.isFinite(num)) return num;

  const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
	const exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), UNITS.length - 1);
	const numStr = Number((num / Math.pow(1000, exponent)).toPrecision(3));
	const unit = UNITS[exponent];

	return numStr + ' ' + unit;
}

function setCanUpload(can) {
  $('button.submit').toggleClass('disabled', !can);
}

function handleFilesChanged() {
  $('.files tbody').empty();

  setCanUpload(true);

  var stats = [];

  for(var i=0; i<this.files.length; i++) {
    stats.push(addFile(this.files[i]));
  }

  var uploadable = stats.filter(function(v) {return v;}).length;
  
  $('button.submit').attr('title', "upload " + uploadable + " files");
  
  if(this.files.length == 0) setCanUpload(false);
}

function attachListeners() {
  $('#file-upload')[0].addEventListener('change', handleFilesChanged, false);
}

function addFile(file) {
  var status = 'ok';
  var message = 'ready';

  console.log(file);

  var tr = $('<tr></tr>');

  if(file.size > CONFIG.upload.max_size) {
    status = 'error';
    message = 'file too large';
    //setCanUpload(false);
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

  if(status === 'error') return false;
  return true;
}

$(document).ready(function() {
  attachListeners();
});
