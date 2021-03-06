angular.module('orderCloud')
    .config(CategoryBrowseConfig)
    .controller('CategoryBrowseCtrl', CategoryBrowseController)
;

function CategoryBrowseConfig($stateProvider, catalogid){
    $stateProvider
        .state('categoryBrowse', {
            parent:'base',
            url:'/browse/categories?categoryID?productPage?categoryPage?pageSize?sortBy?filters',
            templateUrl:'categoryBrowse/templates/categoryBrowse.tpl.html',
            controller:'CategoryBrowseCtrl',
            controllerAs:'categoryBrowse',
            resolve: {
                Parameters: function($stateParams, ocParameters) {
                    return ocParameters.Get($stateParams);
                },
                CategoryList: function(OrderCloudSDK, Parameters) {
                    if(Parameters.categoryID) { Parameters.filters ? Parameters.filters.ParentID = Parameters.categoryID : Parameters.filters = {ParentID:Parameters.categoryID}; }
                    var opts = {
                        page: Parameters.categoryPage,
                        pageSize: Parameters.pageSize || 12,
                        sortBy:  Parameters.sortBy,
                        filters: Parameters.filters,
                        catalogID: 1
                    };
                    
                    return OrderCloudSDK.Me.ListCategories(opts);
                },
                ProductList: function(OrderCloudSDK, Parameters) {
                    if(Parameters && Parameters.filters && Parameters.filters.ParentID) {
                        delete Parameters.filters.ParentID;
                        var opts = {
                            page: Parameters.categoryPage,
                            pageSize: Parameters.pageSize || 12,
                            sortBy:  Parameters.sortBy,
                            filters: Parameters.filters,
                            categoryID: Parameters.categoryID
                        };
                        return OrderCloudSDK.Me.ListProducts(opts);
                    } else {
                        return null;
                    }
                },
                SelectedCategory: function(OrderCloudSDK, Parameters){
                    if(Parameters.categoryID){
                        var opts = {
                            page: 1,
                            pageSize: 1,
                            filters: {ID:Parameters.categoryID},
                            depth: 'all'
                        };
                        return OrderCloudSDK.Me.ListCategories(opts)
                            .then(function(data){
                                return data.Items[0];
                            });
                        
                    } else {
                        return null;
                    }
                    
                }
            }
        });
}

function CategoryBrowseController($state, ocParameters, CategoryList, ProductList, Parameters, SelectedCategory) {
    var vm = this;
    vm.categoryList = CategoryList;
    vm.productList = ProductList;
    vm.parameters = Parameters;
    vm.selectedCategory = SelectedCategory;

    vm.getNumberOfResults = function(list){
        return vm[list].Meta.ItemRange[0] + ' - ' + vm[list].Meta.ItemRange[1] + ' of ' + vm[list].Meta.TotalCount + ' results';
    };

    vm.filter = function(resetPage) {
        $state.go('.', ocParameters.Create(vm.parameters, resetPage));
    };

    vm.updateCategoryList = function(category){
        vm.parameters.categoryID = category;
        vm.filter(true);
    };

    vm.changeCategoryPage = function(newPage){
        vm.parameters.categoryPage = newPage;
        vm.filter(false);
    };
    
    vm.changeProductPage = function(newPage){
        vm.parameters.productPage = newPage;
        vm.filter(false);
    };
}
