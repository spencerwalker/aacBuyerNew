angular.module('orderCloud')
    .config(LoginConfig)
    .factory('LoginService', LoginService)
    .controller('LoginCtrl', LoginController)
;

function LoginConfig($stateProvider) {
    $stateProvider
        .state('login', {
            url: '/login/:token',
              templateUrl: 'login/templates/login.tpl.html',
            controller: 'LoginCtrl',
            controllerAs: 'login'
        })
    ;
}

function LoginService($q, $window, $state, $cookies, toastr, OrderCloudSDK, ocRolesService, clientid, anonymous) {
    return {
        SendVerificationCode: _sendVerificationCode,
        ResetPassword: _resetPassword,
        RememberMe: _rememberMe,
        Logout: _logout
    };

    function _sendVerificationCode(email) {
        var deferred = $q.defer();

        var passwordResetRequest = {
            Email: email,
            ClientID: clientid,
            URL: encodeURIComponent($window.location.href) + '{0}'
        };

        OrderCloudSDK.PasswordResets.SendVerificationCode(passwordResetRequest)
            .then(function() {
                deferred.resolve();
            })
            .catch(function(ex) {
                deferred.reject(ex);
            });

        return deferred.promise;
    }

    function _resetPassword(resetPasswordCredentials, verificationCode) {
        var deferred = $q.defer();

        var passwordReset = {
            ClientID: clientid,
            Username: resetPasswordCredentials.ResetUsername,
            Password: resetPasswordCredentials.NewPassword
        };

        OrderCloudSDK.PasswordResets.ResetPassword(verificationCode, passwordReset).
            then(function() {
                deferred.resolve();
            })
            .catch(function(ex) {
                deferred.reject(ex);
            });

        return deferred.promise;
    }

    function _logout(){
        angular.forEach($cookies.getAll(), function(val, key) {
            $cookies.remove(key);
        });
        ocRolesService.Remove();
        $state.go(anonymous ? 'home' : 'login', {}, {reload: true});
    }

    function _rememberMe() {
        var availableRefreshToken = OrderCloudSDK.GetRefreshToken() || null;

        if (availableRefreshToken) {
            OrderCloudSDK.Auth.RefreshToken(availableRefreshToken, clientid, scope)
                .then(function(data) {
                    OrderCloudSDK.SetToken(data.access_token);
                    $state.go('home');
                })
                .catch(function () {
                    toastr.error('Your session has expired, please log in again.');
                    _logout();
                });
        } else {
            _logout();
        }
    }
}

function LoginController($state, $stateParams, $exceptionHandler, OrderCloudSDK, OrderCloud, LoginService, ocRolesService, buyerid, clientid, scope, defaultstate) {
    var vm = this;
    vm.credentials = {
        Username: null,
        Password: null
    };
    vm.token = $stateParams.token;
    vm.form = vm.token ? 'reset' : 'login';
    vm.setForm = function(form) {
        vm.form = form;
    };
    vm.rememberStatus = false;

    vm.submit = function() {
        OrderCloudSDK.Auth.Login(vm.credentials.Username, vm.credentials.Password, clientid, scope)
            .then(function(data) {
                OrderCloudSDK.SetToken(data.access_token);
                if(vm.rememberStatus)OrderCloudSDK.SetRefreshToken(data['refrersh_token']);
                var roles = ocRolesService.Set(data.access_token);
                if (roles.length == 1 && roles[0] == 'PasswordReset') {
                    vm.token = data.access_token;
                    vm.form = 'resetByToken';
                } else {
                    $state.go(defaultstate);
                }
                OrderCloud.BuyerID.Set(buyerid);
                OrderCloud.Auth.SetToken(data['access_token']);
                $state.go(defaultstate);
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            });
    };

    vm.forgotPassword = function() {
        LoginService.SendVerificationCode(vm.credentials.Email)
            .then(function() {
                vm.setForm('verificationCodeSuccess');
                vm.credentials.Email = null;
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            });
    };

    vm.resetPassword = function() {
        LoginService.ResetPassword(vm.credentials, vm.token)
            .then(function() {
                vm.setForm('resetSuccess');
                vm.token = null;
                vm.credentials.ResetUsername = null;
                vm.credentials.NewPassword = null;
                vm.credentials.ConfirmPassword = null;
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
                vm.credentials.ResetUsername = null;
                vm.credentials.NewPassword = null;
                vm.credentials.ConfirmPassword = null;
            });
    };

    vm.resetPasswordByToken = function() {
        vm.loading = OrderCloudSDK.Me.ResetPasswordByToken({NewPassword:vm.credentials.NewPassword})
            .then(function(data) {
                vm.setForm('resetSuccess');
                vm.credentials = {
                    Username:null,
                    Password:null
                }
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            })
    };
}