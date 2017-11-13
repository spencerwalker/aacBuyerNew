angular.module('orderCloud')
    .controller('OCPunchoutCtrl', OrderCloudPunchoutController)
    .controller('OCPunchoutReturnCtrl', OrderCloudPunchoutReturnController)
;

function OrderCloudPunchoutController(Parameters, $sce, $scope, LoginService, adoptAClassromURL){
    var vm = this;
    vm.link = Parameters.link;
    vm.trustSrc = function(src){
        return $sce.trustAsResourceUrl(src);
    };
    vm.frameHeight = $(window).height();
    vm.outboundtURL = vm.trustSrc(vm.link);
     vm.logout = function() {
        LoginService.Logout(adoptAClassromURL);    
    };
}

function OrderCloudPunchoutReturnController($stateParams, $location) {
    window.top.location.href = '/' + (angular.isDefined($stateParams.state) ? $stateParams.state : 'cart');
}