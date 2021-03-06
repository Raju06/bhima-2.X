angular.module('bhima.controllers')
  .controller('EnterpriseController', EnterpriseController);

EnterpriseController.$inject = [
  'EnterpriseService', 'util', 'NotifyService', 'ProjectService', 'ModalService', 'ScrollService', 'SessionService',
];

/**
 * @function EnterpriseController
 *
 * @description
 * This controller binds the basic CRUD operations on the enterprise.
 */
function EnterpriseController(Enterprises, util, Notify, Projects, Modal, ScrollTo, Session) {
  const vm = this;

  vm.enterprise = {};
  vm.maxLength = util.maxTextLength;
  vm.length50 = util.length50;
  vm.length100 = util.length100;
  vm.hasEnterprise = false;

  let $touched = false;

  // bind methods
  vm.submit = submit;
  vm.onSelectGainAccount = onSelectGainAccount;
  vm.onSelectLossAccount = onSelectLossAccount;
  vm.enablePriceLockSetting = enablePriceLockSetting;
  vm.enablePrepaymentsSetting = enablePrepaymentsSetting;
  vm.enableDeleteRecordsSetting = enableDeleteRecordsSetting;
  vm.enablePasswordValidationSetting = enablePasswordValidationSetting;

  // fired on startup
  function startup() {

    // load enterprises
    Enterprises.read(null, { detailed : 1 })
      .then(enterprises => {
        vm.hasEnterprise = (enterprises.length > 0);
        vm.enterprises = vm.hasEnterprise ? enterprises : [];

        /**
         * NOTE: set the enterprise to the first one
         * this choice need the team point of view for to setting the default enterprise
         */
        vm.enterprise = vm.hasEnterprise ? vm.enterprises[0] : {};
        return refreshProjects();
      })
      .catch(Notify.handleError);
  }

  function onSelectGainAccount(account) {
    vm.enterprise.gain_account_id = account.id;
  }

  vm.scrollToSubmission = function scrollToSubmission() {
    ScrollTo('submission');
  };

  function onSelectLossAccount(account) {
    vm.enterprise.loss_account_id = account.id;
  }

  // form submission
  function submit(form) {
    if (form.$invalid) {
      Notify.danger('FORM.ERRORS.HAS_ERRORS');
      return 0;
    }

    // make sure only fresh data is sent to the server.
    if (form.$pristine && !$touched) {
      Notify.warn('FORM.WARNINGS.NO_CHANGES');
      return 0;
    }

    const creation = (vm.hasEnterprise === false);
    const changes = util.filterFormElements(form, true);

    changes.settings = angular.copy(vm.enterprise.settings);

    const promise = (creation) ?
      Enterprises.create(changes) :
      Enterprises.update(vm.enterprise.id, changes);

    return promise
      .then(() => {
        Notify.success(creation ? 'FORM.INFO.SAVE_SUCCESS' : 'FORM.INFO.UPDATE_SUCCESS');
      })
      .then(() => Session.reload())
      .catch(Notify.handleError);
  }

  /* ================================ PROJECT ================================ */

  vm.addProject = addProject;
  vm.editProject = editProject;
  vm.deleteProject = deleteProject;

  // refresh the displayed projects
  function refreshProjects() {
    return Projects.read(null, { complete : 1 })
      .then(projects => {
        vm.projects = projects;
      });
  }

  /**
   * @function editProject
   * @desc launch project modal for editing
   */
  function editProject(id) {
    const params = {
      action     : 'edit',
      identifier : id,
      enterprise : vm.enterprise,
    };

    Modal.openProjectActions(params)
      .then(value => {
        if (!value) { return; }

        refreshProjects();
        Notify.success('FORM.INFO.UPDATE_SUCCESS');
      })
      .catch(Notify.handleError);
  }

  /**
   * @function addProject
   * @desc launch project modal for adding new
   */
  function addProject() {
    Modal.openProjectActions({
      action     : 'create',
      enterprise : vm.enterprise,
    })
      .then(value => {
        if (!value) { return; }

        refreshProjects();
        Notify.success('FORM.INFO.CREATE_SUCCESS');
      })
      .catch(Notify.handleError);
  }

  /**
   * @function deleteProject
   * @desc delete an existing project
   * @param {number} id The project id
   */
  function deleteProject(id, pattern) {
    const params = {
      pattern,
      patternName : 'FORM.PATTERNS.PROJECT_NAME',
    };

    Modal.openConfirmDialog(params)
      .then(bool => {
        if (!bool) { return; }

        Projects.delete(id)
          .then(() => {
            Notify.success('FORM.INFO.DELETE_SUCCESS');
            return refreshProjects();
          })
          .catch(Notify.handleError);
      });
  }

  function enablePriceLockSetting(enabled) {
    vm.enterprise.settings.enable_price_lock = enabled;
    $touched = true;
  }

  function enablePrepaymentsSetting(enabled) {
    vm.enterprise.settings.enable_prepayments = enabled;
    $touched = true;
  }

  function enableDeleteRecordsSetting(enabled) {
    vm.enterprise.settings.enable_delete_records = enabled;
    $touched = true;
  }

  function enablePasswordValidationSetting(enabled) {
    vm.enterprise.settings.enable_password_validation = enabled;
    $touched = true;
  }

  startup();
}
