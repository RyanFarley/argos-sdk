/* Copyright (c) 2010, Sage Software, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

define('Sage/Platform/Mobile/Scene', [
    'require',
    'dojo/_base/array',
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/window',
    './_Component',
    './Layout',
    './View'
], function(
    require,
    array,
    declare,
    lang,
    win,
    _Component,
    Layout,
    View
) {
    return declare('Sage.Platform.Mobile.Scene', [_Component], {
        _registeredViews: null,
        _instancedViews: null,
        _state: null,
        components: [
            {type: Layout, attachPoint: 'layout'}
        ],
        layout: null,

        constructor: function(options) {
            this._registeredViews = {};
            this._instancedViews = {};

            this._state = [];

            lang.mixin(this, options);
        },
        startup: function() {
            this.layout.placeAt(win.body());

            this.inherited(arguments);
        },
        destroy: function() {
            this.inherited(arguments);

            for (var name in this._instancedViews)
            {
                this._instancedViews[name].destroy();
            }

            this._registeredViews = null;
            this._instancedViews = null;

            this._state = null;
        },
        registerViews: function(definitions) {
            for (var name in definitions)
            {
                this.registerView(name, definitions[name]);
            }
        },
        registerView: function(name, definition) {
            if (definition instanceof View)
            {
                this._instancedViews[name] = definition;
            }
            else
            {
                this._registeredViews[name] = definition;
            }

            /* todo: how to handle home screen support? */

            return this;
        },
        hasView: function(name) {
            return !!(this._instancedViews[name] || this._registeredViews[name]);
        },
        showView: function(name, options, at) {
            var instance = this._instancedViews[name];
            if (instance)
            {
                this._showViewInstance(instance, options, at);

                return;
            }

            var definition = this._registeredViews[name];
            if (definition)
            {
                /* todo: figure out why a `setTimeout` is required here */
                /* if `require` is called within a `require` as part of `dojo/domReady!`, the
                   page `load` event will not fire. */
                setTimeout(lang.hitch(this, this._loadView, name, options, definition, at), 0);
            }
        },
        _createStateSet: function(view, location) {
            var context = view.getContext(),
                tag = view.getTag(),
                hash = [view.id].concat(tag ? tag : []).join(';'),
                stateSet = [],
                stateMark = this._state.length - 1;

            /* todo: add position adjustment */
            /* todo: add pane maximization */
            for (var tier = 0; tier < this.layout.tiers; tier++)
            {
                /* inherit the state of the higher priority tiers */
                stateSet[tier] = this._state[stateMark] && tier < location.tier ? this._state[stateMark][tier] : null;
            }

            stateSet[location.tier] = { hash: hash, context: context };

            return stateSet;
        },
        _createViewSet: function(stateSet) {
            var viewSet = [];

            for (var i = 0; i < stateSet.length; i++)
            {
                var entry = stateSet[i],
                    context = entry && entry.context;

                /* todo: add information for how to transition based on how navigation is happening */
                /* i.e. forward => queue tier 0 ... n
                        backward => queue tier n ... 0

                        with: list => list, detail (detail panel should slide in L to R)
                              list, detail => list (detail panel should pop out) */
                if (context)
                    viewSet.push({
                        view: this._instancedViews[context.id]
                    });
                else
                    viewSet.push({});
            }

            return viewSet;
        },
        _showViewInstance: function(view, options, at) {
            var location;

            if (typeof at === 'string')
            {
                /* todo: remember the last view shown? */
                /* the location is not a tracked pane, simply show the view */
                if (this.layout.panes[at].tier === false)
                {
                    this.layout.show(view, at).then(
                        lang.hitch(this._onLayoutShowComplete),
                        lang.hitch(this._onLayoutShowError)
                    );

                    return;
                }

                location = {tier: this.layout.panes[at].tier};
            }
            else if (typeof at === 'number')
            {
                location = {tier: at};
            }

            location = location || {tier: view.tier};

            /* todo: is `activate` the right name for this? */
            view.activate(options); /* activation required in order to build context (i.e. hash, etc.) */

            var stateSet = this._createStateSet(view, location),
                viewSet = this._createViewSet(stateSet);

            /* todo: trim state to item before match of `stateSet` */

            console.log('state: %o', this._state);
            console.log('view: %o', viewSet);

            /*
              A scene tells the layout to apply a view set.  This causes the layout to invoke
              one or more transitions (usually only one, but potentially more).  The scene
              should not show another view until the transitions are all complete.  Each pane is
              responsible for it's own transition.

              scene => layout (apply)
              scene <= layout (deferred)
              scene wait

              layout => pane 0 (show)
              layout <= pane 0 (deferred)
              ...
              layout => pane N (show)
              layout <= pane N (deferred)
              layout wait 0..N
              layout complete scene deferred

              scene save state
             */
            this.layout.apply(viewSet).then(
                lang.hitch(this._onLayoutApplyComplete, stateSet),
                lang.hitch(this._onLayoutApplyError, stateSet)
            );
        },
        _onLayoutShowComplete: function() {

        },
        _onLayoutShowError: function() {
        },
        _onLayoutApplyComplete: function(stateSet) {
            this._state.push(stateSet);
        },
        _onLayoutApplyError: function(stateSet) {
        },
        _loadView: function(name, options, definition, at) {
            require([definition.type], lang.hitch(this, this._onRequireComplete, name, options, definition, at));
        },
        _onRequireComplete: function(name, options, definition, at, ctor) {
            /* todo: always replace id with name? */
            var instance = new ctor(lang.mixin({id: name}, definition.props));

            /* todo: safe to call this here? (not added to DOM yet) */
            instance.startup();

            this._instancedViews[name] = instance;

            this._showViewInstance(instance, options, at);
        }
    });
});