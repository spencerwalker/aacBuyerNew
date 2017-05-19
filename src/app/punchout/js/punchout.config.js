angular.module('orderCloud')
    .config(OrderCloudPunchoutConfig)
    .config(OrderCloudPunchoutStatesConfig)
;

function OrderCloudPunchoutConfig($ocPunchoutProvider) {
    var punchouts = [
        {Name: 'officedepot', CategoryID: 'TopStores_OfficeDepot', SupplierPartID: 'AAA'},
        {Name: 'bestbuy', CategoryID: 'TopStores_BestBuy'},
        {Name: 'kaplan', CategoryID: 'TopStores_Kaplan'},
        {Name: 'reallygoodstuff', CategoryID: 'TopStores_ReallyGoodStuff'},
        {Name: 'schoolspeciality', CategoryID: 'TopStores_SchoolSpecialty'},
        {Name: 'freyscientific', CategoryID: 'TopStores_FreyScientific'}
    ];

    angular.forEach(punchouts, function(punchout) {
        $ocPunchoutProvider.AddPunchout(punchout);
    });
}

function OrderCloudPunchoutStatesConfig($stateProvider) {
    $stateProvider
        .state('punchout', {
            url: '/punchout?link',
            templateUrl: 'punchout/templates/punchout.tpl.html',
            controller: 'OCPunchoutCtrl',
            controllerAs: 'punchout',
            resolve: {
                Parameters: function ($stateParams, ocParameters) {
                    return ocParameters.Get($stateParams);
                }
            }
        })
        .state('punchoutreturn', {
            url: '/punchoutreturn?state',
            templateUrl: 'common/templates/view.loading.tpl.html',
            controller: 'OCPunchoutReturnCtrl'
        })
    ;
}