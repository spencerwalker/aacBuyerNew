angular.module('orderCloud')
    .config(ProductConfig)
    .controller('ProductDetailCtrl', ProductDetailController)
;

function ProductConfig($stateProvider) {
    $stateProvider
        .state('productDetail', {
            parent: 'base',
            url: '/product/:productid',
            templateUrl: 'productDetail/templates/productDetail.tpl.html',
            controller: 'ProductDetailCtrl',
            controllerAs: 'productDetail',
            resolve: {
                Product: function ($stateParams, OrderCloud) {
                    return OrderCloud.Me.GetProduct($stateParams.productid);
                },
                CategoryList: function(OrderCloud, Parameters) {
                    if(Parameters.categoryID) { Parameters.filters ? Parameters.filters.ParentID = Parameters.categoryID : Parameters.filters = {ParentID:Parameters.categoryID}; } 
                    return OrderCloud.Me.ListCategories(null, Parameters.categoryPage, Parameters.pageSize || 12, null, Parameters.sortBy, Parameters.filters, 1);
                }
            }
        });
}

function ProductDetailController($exceptionHandler, Product, CurrentOrder, ocLineItems, toastr, CategoryList) {
    var vm = this;
    vm.item = Product;
    console.log('Product :: ', vm.item);
    console.log('CategoryList :: ', CategoryList);
    vm.finalPriceBreak = null;

    vm.addToCart = function() {
        ocLineItems.AddItem(CurrentOrder, vm.item)
            .then(function(){
                toastr.success('Product added to cart', 'Success')
            })
            .catch(function(error){
               $exceptionHandler(error);
            });
    };

    vm.findPrice = function(qty){
        angular.forEach(vm.item.StandardPriceSchedule.PriceBreaks, function(priceBreak) {
            if (priceBreak.Quantity <= qty)
                vm.finalPriceBreak = angular.copy(priceBreak);
        });

        return vm.finalPriceBreak.Price * qty;
    };
    
}
