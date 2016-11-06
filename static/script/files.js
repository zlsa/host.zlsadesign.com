
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

var files = [];

class File {
  
  constructor(info) {
    this.file = info;
    this.status = 'waiting';
  }

  tooLarge() {
    return (this.file.size > CONFIG.upload.max_size);
  }

  canUpload() {
    return !this.tooLarge();
  }

  createHtml() {
    let status = 'ok';
    let message = 'ready';

    this.html = $('<tr data-status="' + this.status + '"></tr>');

    var name_el = $('<td class="name"></td>');
    name_el.text(this.file.name);

    var size_el = $('<td class="size"></td>');
    size_el.text(prettyBytes(this.file.size));

    var message_el = $('<td class="message"><span class="text"></td>');
    message_el.find('.text').text(message);
    
    this.html.append(name_el);
    this.html.append(size_el);
    this.html.append(message_el);

    $('.files tbody').append(this.html);
    
    if(this.tooLarge()) {
      this.setError('file too large');
    }

  }

  canUpload() {
    if(this.status == 'waiting') return true;
    return false;
  }

  isUploading() {
    if(this.status == 'uploading') return true;
    return false;
  }

  setStatus(status) {
    this.status = status;
    this.html.attr('data-status', status);
  }

  setUrl(url) {
    var name = this.html.find('.name');

    name.empty();
    name.append('<a></a>');
    
    var link = name.find('a');

    link.text(this.file.name);
    link.attr('href', url);
  }

  createUploader() {
    this.form = new FormData();
    this.form.append('files', this.file, this.file.name);
    this.form.append('user', $('#user').val());
  }

  create() {
    this.createHtml();
    this.createUploader();
  }

  createProgress() {
    var progress = $('<div class="progress hidden"><div class="trough"><div class="bar"></div></div></div>');

    this.html.find('.message').append(progress);

    setTimeout(function() {
      progress.removeClass('hidden');
    }, 0);
  }

  setProgress(frac) {
    this.setStatus('uploading');
    
    this.html.find('.message .text').text('');
    
    if(this.html.find('.progress').length == 0) {
      this.createProgress();
    }

    this.html.find('.progress .bar').css('width', (frac * 100) + '%');
    
  }

  setMessage(message) {
    var file = this;
    
    setTimeout(function() {
      file.html.find('.progress').addClass('hidden');
    }, 0);
    
    this.html.find('.message .text').text(message);
  }

  setError(error) {
    this.setStatus('error');
    this.setMessage(error);
  }

  uploadComplete(event) {
    if(!event.target.response.files) {
      if(event.target.status === 401) {
        this.setError('not authorized');
      } else {
        this.setError('file rejected');
      }
      return;
    }
    
    let upload = event.target.response.files[0];

    this.setStatus('uploaded');
    
    if(event.target.status === 200) {
      this.setUrl(upload.url);
      this.setMessage(upload.message);
    } else {
      this.setError(upload.message);
    }

    uploadNextFile();
  }

  uploadError(event) {
    console.log(event);

    this.setStatus('error');
    
    uploadNextFile();
  }

  uploadProgress(event) {
    if(!this.uploaded) {
      this.setProgress(event.loaded / event.total);
    }
  }

  upload() {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    xhr.responseType = 'json';
    xhr.setRequestHeader('Accept', 'application/json');

    let file = this;

    this.setMessage('uploading');

    xhr.addEventListener('load', function(event) {
      file.uploadComplete.call(file, event);
    });

    xhr.addEventListener('error', function(event) {
      file.uploadError.call(file, event);
    });

    xhr.upload.onprogress = function(event) {
      file.uploadProgress.call(file, event);
    };

    xhr.send(this.form);
  }
  
};

function uploadNextFile() {

  var concurrent_max = 3;
  var uploading = 0;
  
  for(let i=0; i<files.length; i++) {
    if(files[i].isUploading()) {
      uploading += 1;
      continue;
    }
    if(files[i].canUpload()) {
      files[i].upload();
      uploading += 1;

      if(uploading >= concurrent_max)
        break;
    }
  }
}

function setCanUpload(can) {
  $('button.submit').toggleClass('disabled', !can);
}

function handleFilesChanged() {
  setCanUpload(true);

  for(let i=0; i<this.files.length; i++) {
    let f = new File(this.files[i]);
    f.create();
    files.push(f);
  }

  uploadNextFile();

  var uploadable = files.filter(function(v) {return v.canUpload();}).length;
  
  $('button.submit').attr('title', "upload " + uploadable + " files");
  
  if(this.files.length == 0) setCanUpload(false);
}

function attachListeners() {
  $('#file-upload')[0].addEventListener('change', handleFilesChanged, false);
}

$(document).ready(function() {
  attachListeners();
});
