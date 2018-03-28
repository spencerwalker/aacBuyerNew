angular.module('orderCloud')
	.config(HomeConfig)
	.controller('HomeCtrl', HomeController)
;

function HomeConfig($stateProvider) {
	$stateProvider
		.state('home', {
			parent: 'base',
			url: '/home',
			templateUrl: 'home/templates/home.tpl.html',
			controller: 'HomeCtrl',
			controllerAs: 'home',
			data: {
				pageTitle: 'Home'
			}
		})
	;
}
//we might want to reconsider the way handle the html, it would be better to have a object with an imaging mapping , so that we can dynamically populate the ID, rather than making more assumptions. If they change the way they organize the test id vs production ids there will be bugs.
function HomeController(vendors, $state, ocPunchout, CurrentOrder, environment) {
	var vm = this;
	vm.vendors = vendors;
	vm.toPunchOut = function(ID){
		if((environment === 'test') | ( environment === 'staging')) ID =  ID + 'Test';
		var punchoutCategory = ocPunchout.IsPunchoutCategory(ID);
        if (punchoutCategory) {
            vm.loading = ocPunchout.SetupRequest(punchoutCategory.Name, punchoutCategory.SupplierPartID, CurrentOrder.ID)
                .then(function(data) {
                    $state.go('punchout', {link:data.StartURL});
                });
        } else {
            $state.go('home');
        }
	}
}
