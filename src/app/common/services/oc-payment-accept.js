angular.module('orderCloud')
    .factory('ccPayment', ccPaymentService)
;

function ccPaymentService($http, $q, $exceptionHandler, OrderCloudSDK, ocAuthNet) {
    var service = {
        Get: _get
    }

    function _get(order, user) {
        return OrderCloudSDK.Payments.List('outgoing', order.ID)
            .then(function(payments) {
                var queue = [];
                _.each(payments.Items, function(paymentData) {
                    if(paymentData.Type === 'CreditCard' && !paymentData.Accepted) {
                        queue.push(function() {
                            return ocAuthNet.AuthCaptureTransaction(order, paymentData)
                                .then(function(data) {
                                    if(data.ResponseBody.ChargeStatus === '1') {
                                        return OrderCloudSDK.Payments.Patch('outgoing', order.ID, paymentData.ID, {
                                            Accepted: true
                                        });
                                    } else {
                                        
                                    }
                                })
                                .catch(function(ex) {
                                    $exceptionHandler(ex);
                                })
                        }());
                    }
                })
                return $q.all(queue);
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            })
    }

    return service;
    
}