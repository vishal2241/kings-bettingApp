myApp.controller("HomeCtrl", function (
  $scope,
  $ionicModal,
  $timeout,
  Service,
  jStorageService,
  $state,
  $stateParams,
  $rootScope,
  ionicToast,
  TemplateService
) {
  var user = $.jStorage.get("userId");
  $scope.profits = [];
  Service.apiCallWithUrl(
    mainServer + "api/member/getOne", {
      _id: user
    },
    function (data) {
      $scope.memberMinRate = data.data.minRate[0].memberMinRate;
      $scope.username = data.data.username;
    }
  );
  $scope.unmatched = $stateParams.unmatched;
  var accessToken = $.jStorage.get("accessToken");
  var userid = $.jStorage.get("userId");
  $scope.bet = false;
  $scope.showBet = function (market, runner, type) {
    if (!$stateParams.unmatched) {
      $scope.liability = 0;
      $scope.minBetError = false;
      // $scope.betSlipRunner = runner;
      $scope.betSlipRunner = {
        odds: type == "BACK" ? runner.singleBackRate : runner.singleLayRate,
        type: type,
        eventId: market.parentCategory.betfairId,
        event: market.eventName,
        selectionId: runner.betfairId,
        selectionName: runner.name,
        sport: "Cricket",
        marketId: market.betfairId,
        accessToken: accessToken,
        marketName: market.name,
        userId: userid,
        handicap: runner.handicap
      };
      console.log($scope.betSlipRunner);
      if ($scope.userConfigData.oneClickStatus) {
        $scope.betSlipRunner.stake = $scope.userConfigData.oneClickActiveStake;
        $scope.calculatePL(type);
        if ($scope.minBetError) {
          ionicToast.show("Please increase stake amount");
        } else {
          $scope.betPlacing = true;
          $scope.placeBet();
        }
      }
    }
  };
  $scope.removeBet = function (type) {
    $scope.betSlipRunner = {};
    $scope.calculatePL(type);
  };

  $scope.incOrDec = function (num, event, type) {
    var num2 = 0;
    if ((event.keyCode == 38 || event == "up") && num < 1000) {
      if (num >= 1.01 && num < 5) {
        num2 = 0.01;
      } else if (num >= 5 && num < 10) {
        num2 = 0.1;
      } else if (num >= 10 && num < 20) {
        num2 = 0.5;
      } else if (num >= 20 && num < 30) {
        num2 = 1;
      } else if (num >= 30 && num < 50) {
        num2 = 2;
      } else if (num >= 50 && num < 100) {
        num2 = 5;
      } else if (num >= 100 && num < 1000) {
        num2 = 10;
      }
      num = num + num2;
      num = +(Math.round(num + "e+2") + "e-2");
    } else if ((event.keyCode == 40 || event == "down") && num > 1.01) {
      if (num > 1.01 && num <= 5) {
        num2 = 0.01;
      } else if (num > 5 && num <= 10) {
        num2 = 0.1;
      } else if (num > 10 && num <= 20) {
        num2 = 0.5;
      } else if (num > 20 && num <= 30) {
        num2 = 1;
      } else if (num > 30 && num <= 50) {
        num2 = 2;
      } else if (num > 50 && num <= 100) {
        num2 = 5;
      } else if (num > 100 && num <= 1000) {
        num2 = 10;
      }
      num = num - num2;
      num = +(Math.round(num + "e+2") + "e-2");
    }
    $scope.calculatePL(type);
    return num;
  };


  $scope.checkDate = function (data) {
    if (data) {
      if (
        new Date(data.marketStartTime) > new Date() &&
        (data.betfairStatus == "OPEN" || data.isSuspended == "No")
      ) {
        return true;
      } else if (
        new Date(data.marketStartTime) <= new Date() &&
        (data.betfairStatus == "OPEN" ||
          data.isSuspended == "No" ||
          data.inPlayStatus == "Open")
      ) {
        return false;
      } else if (data.betfairStatus != "OPEN" || data.isSuspended == "Yes") {
        return null;
      }
    } else {
      return null;
    }
  };

  $scope.loadingData = true;

  function establishSocketConnection() {
    _.each($scope.marketData, function (market) {
      Service.apiCallWithData(
        "Book/getUserBook", {
          marketId: market.betfairId,
          user: user
        },
        function (bookInfo) {
          if (bookInfo.value) {
            market.bookInfo = bookInfo.data.horse;
            market.userRate = bookInfo.data.userRate;
            $scope.calculatePlacedBookAmt();
          }
        }
      );
      // console.log("Book_" + market.betfairId + "_" + user);
      TemplateService.sportsBookServerSocket.on(
        "Book_" + market.betfairId + "_" + user,
        function onConnect(bookData) {
          console.log(
            "user book socket data**************** //////////////////////",
            bookData
          );
          market.bookInfo = bookData.horse;
          market.userRate = bookData.userRate;
          $scope.calculatePlacedBookAmt();
        }
      );
      TemplateService.ratesServerSocket.on(
        "market_" + market.betfairId,
        function onConnect(data) {
          market.allZero = true;
          _.each(market.runners, function (runner) {
            _.each(data.rates, function (rate) {
              if (runner.betfairId == rate.id.toString()) {
                _.each(rate.batb, function (backRate) {
                  if (
                    backRate[0] == 0 &&
                    runner.singleBackRate != backRate[1]
                  ) {
                    runner.singleBackRate = backRate[1];
                    runner.singleBackSize = backRate[2];
                    runner.singleBackRateBlink = true;
                    $timeout(function () {
                      runner.singleBackRateBlink = false;
                    }, 1000);
                  }
                });

                _.each(rate.batl, function (layRate) {
                  if (layRate[0] == 0 && runner.singleLayRate != layRate[1]) {
                    runner.singleLayRate = layRate[1];
                    runner.singleLaySize = layRate[2];
                    runner.singleLayRateBlink = true;
                    $timeout(function () {
                      runner.singleLayRateBlink = false;
                    }, 1000);
                  }
                });
              }
            });
            // runner.singleBackRate = 0;
            // runner.singleLayRate = 0;
            if (runner.singleBackRate > 0 || runner.singleLayRate > 0) {
              market.allZero = false;
            }
          });
          if (data.betfairStatus == "SUSPENDED")
            market.betfairStatus = data.betfairStatus;
          // var sortedArray = _.sortBy(market.runners, ['sortPriority']);
          // market.runners = [];
          // _.each(sortedArray, function (n) {
          //     market.runners[n.sortPriority - 1] = n;
          // });
          $scope.$apply();
        }
      );
    });
  }

  $scope.getMarketIds = function (value) {
    if (value) $scope.loadingData = true;
    if ($state.current.name == "home.inside") {
      if (!_.isEmpty(value.parentId)) {
        value.competitionId = value.parentId;
      }
      delete value.parentId;
    }
    Service.apiCallWithData("Category/getMarketIds", value, function (data) {
      if (data.value) {
        $scope.loadingData = false;
        if (!_.isEmpty(data.data)) {
          $scope.loadingData = false;
          $scope.marketData = data.data;
          if ($stateParams.parentId) {
            $scope.singleMarket = _.remove($scope.marketData, function (market) {
              var sortedArray = _.sortBy(market.runners, ["sortPriority"]);
              market.runners = sortedArray;
              return market.name == "Match Odds";
            })[0];
            $scope.marketData.unshift($scope.singleMarket);
          }
          _.each($scope.marketData, function (market) {
            var sortedArray = _.sortBy(market.runners, ["sortPriority"]);
            market.runners = sortedArray;
            _.each(market.runners, function (runner) {
              _.each(runner.back, function (backRate) {
                if (backRate[0] == 0) {
                  runner.singleBackRate = backRate[1];
                  runner.singleBackSize = backRate[2];
                }
              });
              _.each(runner.lay, function (layRate) {
                if (layRate[0] == 0) {
                  runner.singleLayRate = layRate[1];
                  runner.singleLaySize = layRate[2];
                }
              });
            });
          });
          $scope.home = true;
          $scope.updated = true;
          if (!_.isEmpty($scope.updateMatch)) {
            $scope.updateMatch.pop();
            $scope.getMarketIds({
              game: $scope.selectedGame
            });
          }
          if ($stateParams.unmatched) {
            Service.apiCallWithData(
              "Bet/getOne", {
                _id: $stateParams.unmatched
              },
              function (data) {
                data = data.data;
                $scope.betSlipRunner = {
                  accessToken: accessToken,
                  sport: data.eventType,
                  betId: data._id,
                  marketId: data.marketId,
                  type: data.type,
                  userId: userid,
                  event: data.event,
                  eventId: $stateParams.eventId,
                  selectionId: data.horse,
                  selectionName: data.selectionName,
                  odds: data.betRate,
                  marketName: data.marketName,
                  userName: $scope.username,
                  stake: data.stake,
                  oldStake: data.stake,
                  handicap: data.handicap
                };
                $scope.calculatePL(data.type);
              }
            );
          }
          establishSocketConnection();
          // console.log($scope.marketData);
        } else {
          $scope.marketData = [];
        }
      } else {
        // alert("Unable get markets");
      }
    });
  };
  $scope.getMarketIds({
    game: $stateParams.game ? $stateParams.game : "Cricket",
    parentId: $stateParams.parentId
  });
  $scope.updateMatch = [];
  var i = 1;
  TemplateService.sportsBookServerSocket.on(
    "updateMatchStatus",
    function onConnect(data) {
      console.log("updateMatchStatus", data);
      if (data == "updated") {
        if ($scope.updated) {
          $scope.updated = false;
          $scope.getMarketIds({
            game: $stateParams.game,
            parentId: $stateParams.parentId
          });
        } else {
          $scope.updateMatch.push(i);
          i++;
        }
      }
    }
  );
  //Socket for current bet status after winner declared
  TemplateService.sportsBookServerSocket.on(
    "winnerDeclared",
    function onConnect(winnerData) {
      $scope.getMarketIds({
        game: $stateParams.game
      });
    }
  );

  $scope.format = "yyyy/MM/dd";
  $scope.date = new Date();

  $scope.saveFavourite = function (value, isFavourite) {
    var userId = jStorageService.getUserId();
    console.log("favourites clicked", value, isFavourite);

    var obj = {
      marketId: value.betfairId,
      marketMongoId: value._id,
      game: $scope.selectedGame,
      parentId: value.parentCategory._id,
      marketStartTime: value.marketStartTime,
      user: userId,
      isFavourite: !value.isFavourite
    };
    if (obj.isFavourite == true) {
      obj.status = "Open";
    } else {
      obj.status = "Closed";
    }
    Service.apiCallWithData("FavouriteMatch/saveUserFavourites", obj, function (
      data
    ) {
      if (data.value) {
        if (data.data[1]) {
          _.each($scope.marketData, function (n) {
            if (n._id == data.data[1]._id) {
              n.isFavourite = data.data[1].isFavourite;
            }
          });
        }
      }
    });
  };
  $scope.calculatePL = function (type) {
    // var userInfo = jStorageService.getUserData();
    // if (userInfo.minRate && userInfo.minRate[0].memberMinRate) {
    //   $scope.memberMinRate = userInfo.minRate[0].memberMinRate;
    // }
    $scope.minBetError = false;
    // if ($scope.myCurrentBetData && $scope.myCurrentBetData.unMatchedbets) {
    //   _.each($scope.myCurrentBetData.unMatchedbets, function (unMatchedbets) {
    //     _.each(unMatchedbets.betData, function (bet) {
    //       if (bet.type == "BACK") {
    //         bet.profit =
    //           bet.betRate && bet.stake ? (bet.betRate - 1) * bet.stake : 0;
    //       } else {
    //         bet.liability =
    //           bet.betRate && bet.stake ? (bet.betRate - 1) * bet.stake : 0;
    //       }
    //       bet.updatedodds = bet.betRate - 1;
    //       if (!bet.stake || bet.stake >= $scope.memberMinRate) {
    //         bet.error = false;
    //       } else {
    //         bet.error = true;
    //         $scope.minBetError = true;
    //       }
    //     });
    //   });
    //   $scope.checkChangeInBet();
    // }
    if (type == "LAY") {
      $scope.betSlipRunner.liability =
        $scope.betSlipRunner.odds && $scope.betSlipRunner.stake ?
        ($scope.betSlipRunner.odds - 1) * $scope.betSlipRunner.stake :
        0;
      if (
        !$scope.betSlipRunner.stake ||
        $scope.betSlipRunner.stake >= $scope.memberMinRate
      ) {
        $scope.betSlipRunner.error = false;
      } else {
        $scope.betSlipRunner.error = true;
        $scope.minBetError = true;
      }
      $scope.betSlipRunner.updatedodds = $scope.betSlipRunner.odds - 1;
    }

    if (type == "BACK") {
      $scope.betSlipRunner.profit =
        $scope.betSlipRunner.odds && $scope.betSlipRunner.stake ?
        ($scope.betSlipRunner.odds - 1) * $scope.betSlipRunner.stake :
        0;
      if (
        !$scope.betSlipRunner.stake ||
        $scope.betSlipRunner.stake >= $scope.memberMinRate
      ) {
        $scope.betSlipRunner.error = false;
      } else {
        $scope.betSlipRunner.error = true;
        $scope.minBetError = true;
      }
      $scope.betSlipRunner.updatedodds = $scope.betSlipRunner.odds - 1;
    }
    $rootScope.calculateBook($scope.betSlipRunner);
  };

  $rootScope.calculateBook = function (value) {
    $scope.unexecutedProfit = [];
    _.forEach($scope.marketData, function (market, marketIndex) {
      market.book = [];
      if (value.marketId == market.betfairId) {
        market.book.push(value);
      }
      _.each(market.runners, function (runner) {
        delete runner.unexecutedProfit;
        _.each(market.book, function (book) {
          if (book.type == "LAY") {
            if (book.selectionId == runner.betfairId) {
              if (runner.unexecutedProfit) {
                runner.unexecutedProfit =
                  runner.unexecutedProfit + book.liability * -1;
              } else {
                runner.unexecutedProfit = -1 * book.liability;
              }
            } else {
              if (runner.unexecutedProfit) {
                runner.unexecutedProfit = runner.unexecutedProfit + book.stake;
              } else {
                runner.unexecutedProfit = book.stake;
              }
            }
          } else if (book.type == "BACK") {
            if (book.selectionId == runner.betfairId) {
              if (runner.unexecutedProfit) {
                runner.unexecutedProfit = runner.unexecutedProfit + book.profit;
              } else {
                runner.unexecutedProfit = book.profit;
              }
            } else {
              if (runner.unexecutedProfit) {
                runner.unexecutedProfit =
                  runner.unexecutedProfit + book.stake * -1;
              } else {
                runner.unexecutedProfit = book.stake * -1;
              }
            }
          }
        });
        _.each($scope.profits[marketIndex], function (m) {
          if (
            m.betfairId == runner.betfairId &&
            runner.unexecutedProfit &&
            m.amount
          ) {
            runner.unexecutedProfit = m.amount + runner.unexecutedProfit;
          }
        });
      });

      $scope.unexecutedProfit.push(market.runners);
    });
  };
  $scope.betConfirm = function () {
    $scope.betPlacing = true;
    if ($scope.userConfigData.confirmStatus) {
      $scope.openConfirmBet();
    } else {
      $scope.placeBet();
    }
  };
  $scope.placeBet = function () {
    if ($scope.ConfirmBetModal) {
      $scope.closeConfirmBet();
    }
    $timeout(function () {
      $scope.openBetLoader();
      $scope.showTimer = true;
      $scope.countdown = 5;
      $scope.clickButton();
    }, 1000);
    ionicToast.show("Your Bet will submit in 5 seconds");
    var reqData = [];
    reqData.push($scope.betSlipRunner);
    Service.apiCallWithData("Betfair/placePlayerBetNew", reqData, function (
      data
    ) {
      $scope.betPlacing = false;
      $timeout(function () {
        $scope.closeBetLoader();
        $scope.showTimer = false;
      }, 500);

      if (data.value) {
        ionicToast.show("Bet Placed successfully!");
        $scope.removeBet();
      } else {
        if (data.error == "MIN_BET_STAKE_REQUIRED") {
          ionicToast.show("Please increase stake amount");
        } else {
          ionicToast.show("Error while placing Bet");
        }
      }
    });
  };

  $scope.updatePlayerBet = function (bet) {
    $scope.betPlacing = true;
    ionicToast.show("Your Bet will submit in 5 seconds");
    var reqData = [];
    if (bet.oldBetRate !== bet.betRate || bet.oldStake !== bet.stake) {
      var betData = {
        accessToken: accessToken,
        sport: bet.sport,
        betId: bet.betId,
        marketId: bet.marketId,
        type: bet.type,
        userId: userid,
        event: bet.event,
        eventId: bet.eventId,
        selectionId: bet.selectionId,
        selectionName: bet.selectionName,
        odds: bet.odds,
        marketName: bet.marketName,
        userName: $scope.username,
        stake: bet.stake,
        oldStake: bet.stake,
        handicap: bet.handicap
      };
      betData.type == "BACK" ?
        (betData.profit = bet.profit) :
        (betData.liability = bet.liability);
      reqData.push(betData);
    }
    if (reqData.length > 0) {
      Service.apiCallWithData("Betfair/updatePlayerBet", reqData, function (
        data
      ) {
        $scope.betPlacing = false;
        if (data.value) {
          ionicToast.show("Bet Placed successfully!");
          $scope.removeBet();
        } else {
          if (
            data.error == "Insufficient credit limit" ||
            data.error == "Exceeded the profit limit"
          ) {
            ionicToast.show(data.error);
          } else {
            ionicToast.show("Error while placing Bet");
          }
        }
      });
    } else {
      toastr.error("Error while placing Bet");
    }
  };
  $scope.calculatePlacedBookAmt = function () {
    $scope.profits = [];
    _.each($scope.marketData, function (market) {
      _.each(market.runners, function (runner) {
        _.each(market.bookInfo, function (horse) {
          if (runner.betfairId == horse.horse) {
            runner.amount = horse.amount / market.userRate;
          }
        });
      });
      $scope.profits.push(market.runners);
    });
  };
  // Confirm Modal
  $ionicModal
    .fromTemplateUrl("templates/modal/confirmbet.html", {
      scope: $scope,
      animation: "slide-in-up"
    })
    .then(function (modal) {
      $scope.ConfirmBetModal = modal;
    });

  $scope.openConfirmBet = function () {
    $scope.ConfirmBetModal.show();
  };
  $scope.closeConfirmBet = function () {
    $scope.ConfirmBetModal.hide();
  };

  // Betting Modal
  $ionicModal
    .fromTemplateUrl("templates/modal/bet-loader.html", {
      scope: $scope,
      animation: "slide-in-up"
    })
    .then(function (modal) {
      $scope.BetLoaderModal = modal;
    });

  $scope.openBetLoader = function () {
    $scope.BetLoaderModal.show();
  };
  $scope.closeBetLoader = function () {
    $scope.BetLoaderModal.hide();
  };

  $scope.clickButton = function () {
    $timeout(function () {
      if ($scope.countdown > 0 && $scope.showTimer) {
        $scope.countdown -= 1;
        $scope.clickButton();
        console.log($scope.countdown);
      } else {
        delete $scope.countdown;
      }
    }, 1000);
  };

});
