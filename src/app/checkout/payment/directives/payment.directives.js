angular.module('orderCloud')

	//Single Purchase Order Payment
	.directive('ocPaymentPo', OCPaymentPurchaseOrder)
	.controller('PaymentPurchaseOrderCtrl', PaymentPurchaseOrderController)

	//Single Spending Account Payment
	.directive('ocPaymentSa', OCPaymentSpendingAccount)
	.controller('PaymentSpendingAccountCtrl', PaymentSpendingAccountController)

	//Single Credit Card Payment
	.directive('ocPaymentCc', OCPaymentCreditCard)
	.controller('PaymentCreditCardCtrl', PaymentCreditCardController)

	//Single Payment, Multiple Types
	.directive('ocPayment', OCPayment)
	.controller('PaymentCtrl', PaymentController)

	//Multiple Payment, Multiple Types
	.directive('ocPayments', OCPayments)
	.controller('PaymentsCtrl', PaymentsController)
;


function OCPaymentPurchaseOrder() {
	return {
		restrict:'E',
		scope: {
			order: '=',
			payment: '=?'
		},
		templateUrl: 'checkout/payment/directives/templates/purchaseOrder.tpl.html',
		controller: 'PaymentPurchaseOrderCtrl'
	}
}

function PaymentPurchaseOrderController($scope, $rootScope, toastr, OrderCloudSDK, $exceptionHandler) {
    if (!$scope.payment) {
        OrderCloudSDK.Payments.List('outgoing', $scope.order.ID)
            .then(function(data) {
                if (data.Items.length) {
                    $scope.payment.Items[0];
                } else {
                    var payment = {
                        Type: 'PurchaseOrder',
                        DateCreated: new Date().toISOString(),
                        CreditCardID: null,
                        SpendingAccountID: null,
                        Description: null,
                        Amount: $scope.order.Total,
                        xp: {},
                        Editing: true
                    };
                    $scope.payment = payment;
                }
            });
    } else if (!($scope.payment.Type == 'PurchaseOrder' && $scope.payment.CreditCardID == null && $scope.payment.SpendingAccountID == null)) {
        $scope.payment.Type = 'PurchaseOrder';
        $scope.payment.CreditCardID = null;
        $scope.payment.SpendingAccountID = null;
    } else {
        $scope.payment.CreditCardID = null;
        $scope.payment.SpendingAccountID = null;
    }

    $scope.$watch('payment', function(n, o) {
        if (n.Editing) {
            $scope.OCPaymentPurchaseOrder.$setValidity('PurchaseOrderNotSaved', false);
        } else {
            $scope.OCPaymentPurchaseOrder.$setValidity('PurchaseOrderNotSaved', true);
        }
    }, true);
}

function OCPaymentSpendingAccount() {
	return {
		restrict:'E',
		scope: {
			order: '=',
			payment: '=?',
			excludedSpendingAccounts: '=?excludeOptions'
		},
		templateUrl: 'checkout/payment/directives/templates/spendingAccount.tpl.html',
		controller: 'PaymentSpendingAccountCtrl',
		controllerAs: 'paymentSA'
	}
}

function PaymentSpendingAccountController($scope, $rootScope, toastr, OrderCloudSDK, ocCheckoutPaymentService) {
    if (!$scope.payment) {
        OrderCloudSDK.Payments.List('outgoing', $scope.order.ID)
            .then(function(data) {
                if (data.Items.length) {
                    $scope.payment = data.Items[0];
                    $scope.showPaymentOptions = false;
                    getSpendingAccounts();
                } else {
                    var payment = {
                        Type: 'SpendingAccount',
                        DateCreated: new Date().toISOString(),
                        CreditCardID: null,
                        SpendingAccountID: null,
                        Description: null,
                        Amount: $scope.order.Total,
                        xp: {}
                    };
                    $scope.payment = payment;
                    getSpendingAccounts();
                }
            });
    } else {
        delete $scope.payment.CreditCardID;
        if ($scope.payment.xp && $scope.payment.xp.PONumber) $scope.payment.xp.PONumber = null;
        getSpendingAccounts();
    }

    function getSpendingAccounts() {
        var spendingAccountListOptions = {
            page: 1,
            pageSize: 100,
            filters: {RedemptionCode: '!*', AllowAsPaymentMethod: true}
        };
        OrderCloudSDK.Me.ListSpendingAccounts(spendingAccountListOptions)
            .then(function(data) {
                $scope.spendingAccounts = data.Items;
                if ($scope.payment.SpendingAccountID) {
                    $scope.payment.SpendingAccount = _.findWhere($scope.spendingAccounts, {ID: $scope.payment.SpendingAccountID});
                } else {
                    $scope.showPaymentOptions = true;
                }
            });
    }

    $scope.changePaymentAccount = function() {
        ocCheckoutPaymentService.SelectPaymentAccount($scope.payment, $scope.order)
            .then(function(payment) {
                $scope.payment = payment;
                $scope.OCPaymentSpendingAccount.$setValidity('SpendingAccountNotSet', true);
                $rootScope.$broadcast('OCPaymentUpdated', payment);
            });
    };

    $scope.$watch('payment', function(n, o) {
        if (n && !n.SpendingAccountID || n.Editing) {
            $scope.OCPaymentSpendingAccount.$setValidity('SpendingAccountNotSet', false);
        } else {
            $scope.OCPaymentSpendingAccount.$setValidity('SpendingAccountNotSet', true);
        }

        if (n.SpendingAccountID) n.SpendingAccount = _.findWhere($scope.spendingAccounts, {ID: $scope.payment.SpendingAccountID});
        $scope.showPaymentOptions = n.Editing;
        if (n.CreditCardID) delete n.CreditCardID;
        if (n.xp && n.xp.PONumber) delete n.xp.PONumber;
    }, true);
}

function OCPaymentCreditCard() {
	return {
		restrict:'E',
		scope: {
			order: '=',
			payment: '=?',
			excludedCreditCards: '=?excludeOptions'
		},
		templateUrl: 'checkout/payment/directives/templates/creditCard.tpl.html',
		controller: 'PaymentCreditCardCtrl',
		controllerAs: 'paymentCC'
	}
}

function PaymentCreditCardController($scope, $rootScope, toastr, CheckoutConfig, OrderCloudSDK, ocCheckoutPaymentService, ocMyCreditCards) {
    var creditCardListOptions = {
        page: 1,
        pageSize: 100
    };
    OrderCloudSDK.Me.ListCreditCards(creditCardListOptions)
        .then(function(data) {
            $scope.creditCards = data.Items;
        });

    if (!$scope.payment) {
        OrderCloudSDK.Payments.List('outgoing', $scope.order.ID)
            .then(function(data) {
                if (data.Items.length) {
                    $scope.payment = data.Items[0];
                    $scope.showPaymentOptions = false;
                    getCreditCards();
                } else {
                    var payment = {
                        Type: CheckoutConfig.AvailablePaymentMethods[0],
                        DateCreated: new Date().toISOString(),
                        CreditCardID: null,
                        SpendingAccountID: null,
                        Description: null,
                        Amount: $scope.order.Total,
                        xp: {}
                    };
                    $scope.payment = payment;
                    getCreditCards();
                }
            });
    } else {
        delete $scope.payment.SpendingAccountID;
        if ($scope.payment.xp && $scope.payment.xp.PONumber) $scope.payment.xp.PONumber = null;
        getCreditCards();
    }

    function getCreditCards() {
        var creditCardListOptions = {
            page: 1,
            pageSize: 100
        };
        OrderCloudSDK.Me.ListCreditCards(creditCardListOptions)
            .then(function(data) {
                $scope.creditCards = data.Items;
                if ($scope.payment.CreditCardID) {
                    $scope.payment.CreditCard = _.findWhere($scope.creditCards, {ID: $scope.payment.CreditCardID});
                } else {
                    $scope.showPaymentOptions = true;
                }
            });
    }

    $scope.changePaymentAccount = function() {
        ocCheckoutPaymentService.SelectPaymentAccount($scope.payment, $scope.order)
            .then(function(payment) {
                $scope.payment = payment;
                $scope.OCPaymentCreditCard.$setValidity('CreditCardNotSet', true);
                $rootScope.$broadcast('OCPaymentUpdated', payment);
            });
    };

    $scope.$watch('payment', function(n) {
        if (n && !n.CreditCardID || n.Editing) {
            $scope.OCPaymentCreditCard.$setValidity('CreditCardNotSet', false);
        } else {
            $scope.OCPaymentCreditCard.$setValidity('CreditCardNotSet', true);

        }

        if (n.CreditCardID) n.CreditCard = _.findWhere($scope.creditCards, {ID: $scope.payment.CreditCardID});
        $scope.showPaymentOptions = n.Editing;
        if (n.SpendingAccountID) delete n.SpendingAccountID;
        if (n.xp && n.xp.PONumber) delete n.xp.PONumber;
    }, true);

    $scope.createCreditCard = function() {
        ocMyCreditCards.Create()
            .then(function(card) {
                toastr.success('Credit card ending in ' + card.PartialAccountNumber + ' was saved.');
                $scope.creditCards.push(card);
                $scope.updatePayment({creditCard:card});
            });
    };
}

function OCPayment() {
	return {
		restrict:'E',
		scope: {
			order: '=',
			methods: '=?',
			payment: '=?',
			paymentIndex: '=?',
			excludeOptions: '=?'
		},
		templateUrl: 'checkout/payment/directives/templates/payment.tpl.html',
		controller: 'PaymentCtrl',
		controllerAs: 'ocPayment'
	}
}

function PaymentController($scope, $rootScope, OrderCloudSDK, CheckoutConfig, ocCheckoutPaymentService) {
    if (!$scope.methods) $scope.methods = CheckoutConfig.AvailablePaymentMethods;
    if (!$scope.payment) {
        OrderCloudSDK.Payments.List('outgoing', $scope.order.ID)
            .then(function(data) {
                if (ocCheckoutPaymentService.PaymentsExceedTotal(data, $scope.order.Total)) {
                    ocCheckoutPaymentService.RemoveAllPayments(data, $scope.order)
                        .then(function(data) {
                            var payment = {
                                Type: CheckoutConfig.AvailablePaymentMethods[0],
                                DateCreated: new Date().toISOString(),
                                CreditCardID: null,
                                SpendingAccountID: null,
                                Description: null,
                                Amount: $scope.order.Total,
                                xp: {}
                            };
                            $scope.payment = payment;
                        });
                }
                else if (data.Items.length) {
                    $scope.payment = data.Items[0];
                    if ($scope.methods.length == 1) $scope.payment.Type = $scope.methods[0];
                } else {
                    var payment = {
                        Type: CheckoutConfig.AvailablePaymentMethods[0],
                        DateCreated: new Date().toISOString(),
                        CreditCardID: null,
                        SpendingAccountID: null,
                        Description: null,
                        Amount: $scope.order.Total,
                        xp: {},
                        Editing: true
                    };
                    $scope.payment = payment;
                }
            });
    } else if ($scope.methods.length == 1) {
        $scope.payment.Type = $scope.methods[0];
    }

    $rootScope.$on('OCPaymentUpdated', function(event, payment) {
        $scope.payment = payment;
    });

    $scope.savePayment = function(payment) {
        if (payment.ID) {
            OrderCloudSDK.Payments.Delete('outgoing', $scope.order.ID, payment.ID)
                .then(function() {
                    delete payment.ID;
                    createPayment(payment);
                });
        } else {
            createPayment(payment);
        }

        function createPayment(newPayment) {
            if (angular.isDefined(newPayment.Accepted)) delete newPayment.Accepted;
            OrderCloudSDK.Payments.Create('outgoing', $scope.order.ID, newPayment)
                .then(function(data) {
                    data.Editing = false;
                    $scope.OCPayment.$setValidity('ValidPayment', true);
                    $scope.payment = data;
                });
        }
    };


    $scope.paymentValid = function(payment) {
        if (!payment || payment.Editing || payment.Amount != $scope.order.Total) return false; //TODO: refactor for multiple payments

        var valid = false;

        switch(payment.Type) {
            case 'CreditCard':
                valid = payment.CreditCardID != null;
                break;
            case 'SpendingAccount':
                valid = payment.SpendingAccountID != null;
                break;
            case 'PurchaseOrder':
                valid = true;
                break;
        }

        $scope.OCPayment.$setValidity('ValidPayment', (valid && !payment.Editing));

        return valid;
    };
}

function OCPayments() {
	return {
		restrict:'E',
		scope: {
			order: '=',
			methods: '=?'
		},
		templateUrl: 'checkout/payment/directives/templates/payments.tpl.html',
		controller: 'PaymentsCtrl'
	}
}

function PaymentsController($rootScope, $scope, $exceptionHandler, toastr, OrderCloudSDK, ocCheckoutPaymentService, CheckoutConfig) {
    if (!$scope.methods) $scope.methods = CheckoutConfig.AvailablePaymentMethods;

    OrderCloudSDK.Payments.List('outgoing', $scope.order.ID)
        .then(function(data) {
            if (!data.Items.length) {
                $scope.payments = {Items: []};
                $scope.addNewPayment(false);
            }
            else if (ocCheckoutPaymentService.PaymentsExceedTotal(data, $scope.order.Total)) {
                ocCheckoutPaymentService.RemoveAllPayments(data, $scope.order)
                    .then(function(data) {
                        $scope.payments = {Items: []};
                        $scope.addNewPayment(false);
                    });
            }
            else {
                $scope.payments = data;
                calculateMaxTotal();
            }
        });

    $scope.addNewPayment = function(notify) {
        var paymentTotal = $scope.order.Total - _.reduce($scope.payments.Items, function(sum, payment) { return payment.Amount + sum; }, 0);
        var payment = {
            Type: CheckoutConfig.AvailablePaymentMethods[0],
            DateCreated: new Date().toISOString(),
            CreditCardID: null,
            SpendingAccountID: null,
            Description: null,
            Amount: paymentTotal,
            xp: {}
        };
        $scope.payments.Items.push(payment);
        calculateMaxTotal();
    };

    $scope.removePayment = function(scope) {
        // TODO: when api bug EX-1053 is fixed refactor this to simply delete the payment

        return OrderCloudSDK.Payments.Delete('outgoing', $scope.order.ID, scope.payment.ID)
            .then(function(){
                $scope.payments.Items.splice(scope.$index, 1);
                calculateMaxTotal();
                return toastr.success('Payment removed.');
            });
    };

    $scope.updatePaymentAmount = function(scope) {
        if (scope.payment.Amount > scope.payment.MaxAmount || !scope.payment.Amount) return;
        //TODO: Buyer Users currently cannot patch a payment - we need to refactor for multiple payments
        OrderCloudSDK.Payments.Patch('outgoing', $scope.order.ID, scope.payment.ID, scope.payment)
            .then(function(data) {
                toastr.success('Payment amount updated to ' + $filter('currency')(scope.payment.Amount));
                calculateMaxTotal();
            })
            .catch(function(ex) {
                $exceptionHandler(ex);
            });
    };

    $rootScope.$on('OC:PaymentsUpdated', function() {
        calculateMaxTotal();
    });


    function calculateMaxTotal() {
        var paymentTotal = 0;
        $scope.excludeOptions = {
            SpendingAccounts: [],
            CreditCards: []
        };
        angular.forEach($scope.payments.Items, function(payment) {
            paymentTotal += payment.Amount;
            if (payment.SpendingAccountID) $scope.excludeOptions.SpendingAccounts.push(payment.SpendingAccountID);
            if (payment.CreditCardID) $scope.excludeOptions.CreditCards.push(payment.CreditCardID);
            var maxAmount = $scope.order.Total - _.reduce(_.pluck($scope.payments.Items, 'Amount'), function(a, b) {return a + b; });
            payment.MaxAmount = (payment.Amount + maxAmount).toFixed(2);
        });
        $scope.canAddPayment = paymentTotal < $scope.order.Total;
        if($scope.OCPayments) $scope.OCPayments.$setValidity('Insufficient_Payment', !$scope.canAddPayment);
    }
}