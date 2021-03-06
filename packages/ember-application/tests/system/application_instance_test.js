import Engine from 'ember-application/system/engine';
import Application from 'ember-application/system/application';
import ApplicationInstance from 'ember-application/system/application-instance';
import run from 'ember-metal/run_loop';
import jQuery from 'ember-views/system/jquery';
import factory from 'container/tests/test-helpers/factory';
import isEnabled from 'ember-metal/features';
import { privatize as P } from 'container/registry';
import EmberObject from 'ember-runtime/system/object';

let application, appInstance;

QUnit.module('Ember.ApplicationInstance', {
  setup() {
    jQuery('#qunit-fixture').html('<div id=\'one\'><div id=\'one-child\'>HI</div></div><div id=\'two\'>HI</div>');
    application = run(() => Application.create({ rootElement: '#one', router: null }));
  },

  teardown() {
    jQuery('#qunit-fixture').empty();

    if (appInstance) {
      run(appInstance, 'destroy');
    }

    if (application) {
      run(application, 'destroy');
    }
  }
});

QUnit.test('an application instance can be created based upon an application', function() {
  appInstance = run(() => appInstance = ApplicationInstance.create({ application }));

  ok(appInstance, 'instance should be created');
  equal(appInstance.application, application, 'application should be set to parent');
});

QUnit.test('properties (and aliases) are correctly assigned for accessing the container and registry', function() {
  expect(9);

  appInstance = run(() => ApplicationInstance.create({ application }));

  ok(appInstance, 'instance should be created');
  ok(appInstance.__container__, '#__container__ is accessible');
  ok(appInstance.__registry__, '#__registry__ is accessible');

  ok(typeof appInstance.container.lookup === 'function', '#container.lookup is available as a function');

  // stub with a no-op to keep deprecation test simple
  appInstance.__container__.lookup = function() {
    ok(true, '#loookup alias is called correctly');
  };

  expectDeprecation(() => {
    appInstance.container.lookup();
  }, /Using `ApplicationInstance.container.lookup` is deprecated. Please use `ApplicationInstance.lookup` instead./);


  ok(typeof appInstance.registry.register === 'function', '#registry.register is available as a function');
  appInstance.__registry__.register = function() {
    ok(true, '#register alias is called correctly');
  };

  expectDeprecation(() => {
    appInstance.registry.register();
  }, /Using `ApplicationInstance.registry.register` is deprecated. Please use `ApplicationInstance.register` instead./);
});

QUnit.test('customEvents added to the application before setupEventDispatcher', function(assert) {
  assert.expect(1);

  appInstance = run(() => ApplicationInstance.create({ application }));

  application.customEvents = {
    awesome: 'sauce'
  };

  let eventDispatcher = appInstance.lookup('event_dispatcher:main');
  eventDispatcher.setup = function(events) {
    assert.equal(events.awesome, 'sauce');
  };

  appInstance.setupEventDispatcher();
});

QUnit.test('customEvents added to the application before setupEventDispatcher', function(assert) {
  assert.expect(1);

  run(() => appInstance = ApplicationInstance.create({ application }));

  application.customEvents = {
    awesome: 'sauce'
  };

  let eventDispatcher = appInstance.lookup('event_dispatcher:main');
  eventDispatcher.setup = function(events) {
    assert.equal(events.awesome, 'sauce');
  };

  appInstance.setupEventDispatcher();
});

QUnit.test('customEvents added to the application instance before setupEventDispatcher', function(assert) {
  assert.expect(1);

  appInstance = run(() => ApplicationInstance.create({ application }));

  appInstance.customEvents = {
    awesome: 'sauce'
  };

  let eventDispatcher = appInstance.lookup('event_dispatcher:main');
  eventDispatcher.setup = function(events) {
    assert.equal(events.awesome, 'sauce');
  };

  appInstance.setupEventDispatcher();
});

QUnit.test('unregistering a factory clears all cached instances of that factory', function(assert) {
  assert.expect(3);

  appInstance = run(() => ApplicationInstance.create({ application }));

  let PostController = factory();

  appInstance.register('controller:post', PostController);

  let postController1 = appInstance.lookup('controller:post');
  assert.ok(postController1, 'lookup creates instance');

  appInstance.unregister('controller:post');
  appInstance.register('controller:post', PostController);

  let postController2 = appInstance.lookup('controller:post');
  assert.ok(postController2, 'lookup creates instance');

  assert.notStrictEqual(postController1, postController2, 'lookup creates a brand new instance, because the previous one was reset');
});

if (isEnabled('ember-application-engines')) {
  QUnit.test('can build and boot a registered engine', function(assert) {
    assert.expect(7);

    let ChatEngine = Engine.extend();
    let chatEngineInstance;

    application.register('engine:chat', ChatEngine);

    run(() => {
      appInstance = ApplicationInstance.create({ application });
      chatEngineInstance = appInstance.buildChildEngineInstance('chat');
    });

    return chatEngineInstance.boot()
      .then(() => {
        assert.ok(true, 'boot successful');

        [
          'route:basic',
          'event_dispatcher:main',
          'service:-routing'
        ].forEach(key => {
          assert.strictEqual(
            chatEngineInstance.resolveRegistration(key),
            appInstance.resolveRegistration(key),
            `Engine and parent app share registrations for '${key}'`);
        });

        [
          'router:main',
          P`-bucket-cache:main`,
          '-view-registry:main'
        ].forEach(key => {
          assert.strictEqual(
            chatEngineInstance.lookup(key),
            appInstance.lookup(key),
            `Engine and parent app share singleton '${key}'`);
        });
      });
  });

  QUnit.test('can build a registry via Ember.ApplicationInstance.setupRegistry() -- simulates ember-test-helpers', function(assert) {
    let namespace = EmberObject.create({
      Resolver: { create: function() { } }
    });

    let registry = Application.buildRegistry(namespace);

    ApplicationInstance.setupRegistry(registry);

    assert.equal(registry.resolve('service:-document'), document);
  });
}
