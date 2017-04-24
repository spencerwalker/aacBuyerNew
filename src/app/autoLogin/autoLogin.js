angular.module('orderCloud')
    .config(AutoLoginConfig)
    .factory('AutoLoginService', AutoLoginService)
    .controller('AutoLoginCtrl', AutoLoginController)
;

function AutoLoginConfig($stateProvider) {
    $stateProvider
        .state('autoLogin', {
            url: '/autoLogin/:token/:catid/:timestamp/:encryptstamp',
            //templateUrl: 'autoLogin/templates/autoLogin.tpl.html',
            controller: 'AutoLoginCtrl',
            controllerAs: 'autoLogin'
        })
    ;
}

function AutoLoginService($q, $window, $state, toastr, OrderCloud, TokenRefresh, clientid, buyerid, anonymous) {
    return {
        SendVerificationCode: _sendVerificationCode,
        ResetPassword: _resetPassword,
        RememberMe: _rememberMe,
        Logout: _logout
    };
}

function AutoLoginController($state, $stateParams, $exceptionHandler, OrderCloud, OrderCloudSDK, LoginService, TokenRefresh, buyerid, $http) {
    var vm = this;

    vm.token = $stateParams.token;
    vm.timestamp = $stateParams.timestamp;
    vm.encryptstamp = $stateParams.encryptstamp;
    vm.catid = $stateParams.catid;
    console.log('vm.token' + vm.token);
    console.log('vm.catid' + vm.catid);
    vm.form = 'login';
    vm.submit = function() {
        OrderCloud.BuyerID.Set(buyerid);
        OrderCloudSDK.Auth.SetToken(vm.token);
        /*if(vm.catid){
        	console.log('Inside if Submit');
          $state.go('categoryBrowse', {'categoryid':vm.catid});
        }*/
        //else {
        	console.log('Inside else Submit');
        //  $state.go('categoryBrowse',{'categoryID': 'MainCatalog'});
        	$state.go('productBrowse.products', {});
        //	$state.go('productBrowse.products', {'categoryid':vm.catid});
        //}
    };

    var loginTest = function(response) {
      var loginCheck = response.data;
      console.log('loginCheck' + loginCheck);
      if(loginCheck){
        vm.submit();
      }
    }
    console.log('Inside Checklogin block');
    console.log('loginTest' + loginTest);
    var OneMinuteAgo = new Date().getTime() - 60000;
    console.log('Time Stamps' + OneMinuteAgo + '****' + vm.timestamp);
    if(vm.token && vm.timestamp > OneMinuteAgo){
      $http.get('/checklogin/' + vm.timestamp + '/' + vm.encryptstamp).then(loginTest);
    }

}
