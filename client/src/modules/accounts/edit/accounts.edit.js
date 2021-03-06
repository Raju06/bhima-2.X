/** @todo server should not accept not a number */
/** @todo server shouldn't allow bigger than an integer */
/** @todo server should not allow updating fields that are not white listed */
angular.module('bhima.controllers')
  .controller('AccountEditController', AccountEditController);

AccountEditController.$inject = [
  '$rootScope', '$state', 'AccountStoreService', 'AccountService',
  'NotifyService', 'util', 'bhConstants', 'ModalService', 'appcache',
];

function AccountEditController(
  $rootScope, $state, AccountStore, Accounts,
  Notify, util, Constants, ModalService, AppCache
) {
  var accountStore;
  var typeStore;
  var cache = AppCache('AccountEdit');
  var vm = this;
  var id;
  var parentId;
  vm.stateParams = {};
  vm.stateCurrent = {};

  if ($state.params.id || $state.current.name) {
    cache.stateParams = $state.params;
    cache.stateCurrent = $state.current;

    vm.stateParams = cache.stateParams;
    vm.stateCurrent = cache.stateCurrent;
  } else {
    vm.stateParams = cache.stateParams;
    vm.stateCurrent = cache.stateCurrent;
  }

  id = vm.stateParams.id;
  parentId = vm.stateParams.parentId;

  vm.Constants = Constants;

  // expose utility methods
  vm.setRootAccount = setRootAccount;
  vm.updateAccount = updateAccount;
  vm.getTypeTitle = getTypeTitle;
  vm.close = close;
  vm.deleteAccount = deleteAccount;

  vm.batchCreate = false;
  vm.account = null;

  // states that are available as sibling states - these can be used to show and hide
  // relevent components
  vm.states = {
    create: 'accounts.create',
    edit: 'accounts.edit',
  };

  vm.state = angular.copy(vm.stateCurrent.name);
  vm.isCreateState = vm.state === vm.states.create;

  // varaibles to track custom modal error handling, these will be replaced
  // with either the Notification library or a uniform modal error handling utility
  vm.fetchError = null;
  vm.accountNotFound = null;

  vm.rootAccount = {
    id: 0,
    number: 0,
    type_id: Constants.accounts.TITLE,
    label: 'ROOT ACCOUNT',
  };
  vm.rootAccount.hrlabel = Accounts.label(vm.rootAccount);

  /** @todo design how these are served for stores */
  vm.notFound = {
    status: 404,
    code: 'ERRORS.NOT_FOUND',
  };

  settupPage()
    .then(setAccount);

  /**
   * @method settupPage
   *
   * @description
   * Initialise required variables and fetch initial stores for udpating/ creating
   * accounts.
   */
  function settupPage() {
    return AccountStore.accounts()
      .then(handleAccountStore)
      .then(handleAccountType);
  }

  function handleAccountStore(accounts) {
    accountStore = angular.copy(accounts);
    accountStore.post(vm.rootAccount);
    vm.accounts = accountStore.data;
    return AccountStore.types();
  }

  function handleAccountType(types) {
    typeStore = types;
    vm.types = typeStore.data;
  }

  /**
   * @fixme
   * account store is not updated on creation or update
   */
  function setAccount() {
    if (angular.isDefined(id)) {
      // account has been specified; set up updating this account
      loadAccountDetails(id);
    } else {
      // no account specified - a new account will be created
      defineNewAccount();
    }
  }

  function loadAccountDetails(accountId) {
    // load in the account details
    var accountParentId;
    var account = accountStore.get(accountId);

    // if no account is found either the store is out of date or a bad reference
    // has been passed
    if (!account) {
      mockAccountNotFound();
      return;
    }

    vm.account = angular.copy(account);
    accountParentId = vm.account.parent.id || vm.account.parent;
    vm.account.parent = accountStore.get(accountParentId);

    // cast to string to match type options
    vm.account.type_id = String(vm.account.type_id);
  }

  function defineNewAccount() {
    // defining a new account
    // if a previous account existed - use these settings for the next account (batch creation)
    var cacheType;
    var cacheParent;

    if (vm.account) {
      cacheType = vm.account.type_id;
      cacheParent = vm.account.parent.id;
    }
    vm.account = {};

    // default parent -check to see if there is a requested parent ID has been passed in
    if (parentId) {
      vm.account.parent = accountStore.get(parentId);
    } else {
      // set root account
      vm.account.parent = accountStore.get(cacheParent) || accountStore.get(vm.rootAccount.id);
    }

    // default type
    vm.account.type_id = cacheType || null;
  }


  vm.titleChangedValidation = titleChangedValidation;

  // @todo form validation using validators on a component
  function titleChangedValidation(newAccountType) {
    var notTitleAccount = Number(newAccountType) !== Constants.accounts.TITLE;
    var hasChildren = vm.account.children && vm.account.children.length;

    if (notTitleAccount && hasChildren) {
      vm.invalidTitleAccount = true;
    } else {
      vm.invalidTitleAccount = false;
    }
  }


  /** @todo re-factor method - potentially these two actions should be split into two controllers */
  function updateAccount(accountForm) {
    // only require form to have changed if this is not the create state (no initial values)
    var requireDirty = !vm.isCreateState;
    accountForm.$setSubmitted();

    if (accountForm.$invalid) {
      return;
    }
    if (!accountForm.$dirty) {
      return;
    }

    if (vm.invalidTitleAccount) {
      return;
    }

    var number = parseInt(vm.account.number, 10);
    if (number === 0) {
      Notify.danger('ACCOUNT.NOT_0_AS_ACCOUNT_NOMBER');
      return;
    }

    // this will return all elements if requireDirty is set to false
    var submit = util.filterFormElements(accountForm, requireDirty);

    // filter parent
    if (submit.parent) {
      submit.parent = vm.account.parent.id;
    }

    if (vm.isCreateState) {
      handleAccountCreateState();
    } else {
      handleAccountUpdateState();
    }

    function handleAccountCreateState() {
      submit.classe = submit.number.substr(0, 1);

      return Accounts.create(submit)
        .then(handleAccountCreateResult)
        .catch(handleModalError);
    }

    function handleAccountCreateResult(result) {
      vm.fetchError = null;

      // update the id so this account can be directly edited
      submit.id = result.id;
      $rootScope.$broadcast('ACCOUNT_CREATED', submit);
      Notify.success('ACCOUNT.CREATED');

      if (vm.batchCreate) {
        resetModal(accountForm);
      } else {
        close();
      }
    }

    function handleAccountUpdateState() {
      return Accounts.update(vm.account.id, submit)
        .then(handleAccountUpdateResult)
        .catch(handleModalError);
    }

    function handleAccountUpdateResult(result) {
      vm.fetchError = null;
      $rootScope.$broadcast('ACCOUNT_UPDATED', result);
      Notify.success('ACCOUNT.UPDATED');
      close();
    }
  }

  /** Delete an used account */
  function deleteAccount(account) {
    function confirmAccountDeletionResult(bool) {
      // if the user clicked cancel, reset the view and return
      if (!bool) {
        return null;
      }

      if (!account.id) {
        return null;
      }

      return Accounts.delete(account.id)
        .then(handleAccountDeletionResult)
        .catch(handleModalError);
    }

    function handleAccountDeletionResult() {
      $rootScope.$broadcast('ACCOUNT_DELETED', account);
      Notify.success('ACCOUNT.DELETED');
      close();
    }

    ModalService.confirm('FORM.DIALOGS.CONFIRM_DELETE')
      .then(confirmAccountDeletionResult);
  }

  function resetModal(accountForm) {
    accountForm.$setPristine();
    accountForm.$setUntouched();
    settupPage()
      .then(setAccount);
  }

  function getTypeTitle(typeId) {
    if (!typeStore) {
      return null;
    }
    return typeStore.get(typeId).translation_key;
  }

  function setRootAccount(accountForm) {
    accountForm.parent.$setDirty();
    vm.account.parent = accountStore.get(vm.rootAccount.id);
  }

  function close() {
    // transition to the overall UI grid state - this modal will be cleaned up on state change
    $state.go('accounts.list');
  }

  /**
   * @method mockAccountNotFound
   *
   * @description
   * This method mocks a 404 returned from the database - if this becomes a common
   * pattern on the client this could be handled and returned from the store
   */
  function mockAccountNotFound() {
    var error = new Error();
    error.data = vm.notFound;
    vm.accountNotFound = error.data;
    throw error;
  }

  // simply exposes the error to the view
  function handleModalError(error) {
    vm.fetchError = error;
  }
}