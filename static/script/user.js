
function validUser(valid) {
  $('#user').toggleClass('invalid', !valid);
  $('#file-upload-button').toggleClass('disabled', !valid);
  $('body').toggleClass('invalid-user', !valid);
}

function checkValidUser(user) {
  
  if(user.length > 14 || user.length < 7) {
    validUser(false);
  } else {
    validUser(true);
  }
  
}

function saveUser() {
  var val = $('#user').val();
  checkValidUser(val);

  console.log('saved user id ' + val);
  
  localStorage['user'] = val;
}

function restoreUser() {
  var val = localStorage['user'];
  checkValidUser(val);
  
  $('#user').val(val);
}

function attachUserListeners() {
  $('#user').on('keyup mouseup', function() {
    saveUser();
  });
}

$(document).ready(function() {
  restoreUser();
  attachUserListeners();
});
