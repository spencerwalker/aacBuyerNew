angular.module('orderCloud')
    .run(OrderCloudAngularSDKConfig)
    .config(OrderCloudSDKDecorators)
;

function OrderCloudAngularSDKConfig(OrderCloudSDK, appname, apiurl, authurl) {
    var cookiePrefix = appname.replace(/ /g, '_').toLowerCase();
    var apiVersion = 'v1';
    OrderCloudSDK.Config(cookiePrefix, apiurl + '/' + apiVersion, authurl);
}

function OrderCloudSDKDecorators($provide, punchoutproduct) {
    $provide.decorator('OrderCloudSDK', function($delegate, $q) {

        var originalMeListProducts = $delegate.Me.ListProducts;
        function decoratedMeListProducts() {
            var df = $q.defer();

            var originalArguments = arguments[0];
            originalArguments = !originalArguments 
                ? {filters: {ID: '!' + punchoutproduct}} 
                : !originalArguments.filters 
                    ? angular.extend(originalArguments, {filters: {ID: '!' + punchoutproduct}} )
                    : angular.extend(originalArguments, {filters: angular.extend(originalArguments.filters, {ID: '!' + punchoutproduct})})


            if (!originalArguments) originalArguments = {filters: {ID: '!' + punchoutproduct}};
            if (!originalArguments.filters) originalArguments.filters
            angular.extend(originalArguments.filters, {ID: '!' + punchoutproduct});

            originalMeListProducts.apply($delegate, [originalArguments])
                .then(function(data) {
                    df.resolve(data);
                })
                .catch(function(ex) {
                    df.reject(ex);
                });

            return df.promise;
        }

        var originalLineItemsList = $delegate.LineItems.List;
        function decoratedLineItemsList() {
            var df = $q.defer();

            originalLineItemsList.apply($delegate, arguments)
                .then(function(data) {
                    angular.forEach(data.Items, function(lineItem) {
                        lineItem.Punchout = (lineItem.ProductID == punchoutproduct);
                    });
                    df.resolve(data);
                })
                .catch(function(ex) {
                    df.reject(ex);
                })

            return df.promise;
        }

        $delegate.Me.ListProducts = decoratedMeListProducts;
        $delegate.LineItems.List = decoratedLineItemsList;

        return $delegate;
    });
}