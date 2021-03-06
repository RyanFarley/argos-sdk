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

/**
 * @class Sage.Platform.Mobile._ListBase
 * A List View is a view used to display a collection of entries in an easy to skim list. The List View also has a
 * selection model built in for selecting rows from the list and may be used in a number of different manners.
 * @extends Sage.Platform.Mobile.View
 * @alternateClassName _ListBase
 * @requires Sage.Platform.Mobile.ErrorManager
 * @requires Sage.Platform.Mobile.Utility
 * @requires Sage.Platform.Mobile.SearchWidget
 */
define('Sage/Platform/Mobile/_ListBase', [
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/_base/connect',
    'dojo/query',
    'dojo/dom-attr',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/dom-geometry',
    'dojo/dom',
    'dojo/string',
    'dojo/window',
    'dojo/Deferred',
    'dojo/promise/all',
    'dojo/when',
    'Sage/Platform/Mobile/Utility',
    'Sage/Platform/Mobile/ErrorManager',
    'Sage/Platform/Mobile/View',
    'Sage/Platform/Mobile/SearchWidget',
    'Sage/Platform/Mobile/ConfigurableSelectionModel',
    'Sage/Platform/Mobile/RelatedViewManager'
], function(
    declare,
    lang,
    array,
    connect,
    query,
    domAttr,
    domClass,
    domConstruct,
    domGeom,
    dom,
    string,
    win,
    Deferred,
    all,
    when,
    Utility,
    ErrorManager,
    View,
    SearchWidget,
    ConfigurableSelectionModel,
    RelatedViewManager
) {

    return declare('Sage.Platform.Mobile._ListBase', [View], {
        /** 
         * @property {Object}
         * Creates a setter map to html nodes, namely:
         *
         * * listContent => contentNode's innerHTML
         * * remainingContent => remainingContentNode's innerHTML
         */
        attributeMap: {
            listContent: {node: 'contentNode', type: 'innerHTML'},
            remainingContent: {node: 'remainingContentNode', type: 'innerHTML'}
        },
        /**
         * @property {Simplate}
         * The template used to render the view's main DOM element when the view is initialized.
         * This template includes emptySelectionTemplate, moreTemplate and listActionTemplate.
         *
         * The default template uses the following properties:
         *
         *      name                description
         *      ----------------------------------------------------------------
         *      id                   main container div id
         *      title                main container div title attr
         *      cls                  additional class string added to the main container div
         *      resourceKind         set to data-resource-kind
         *
         */
        widgetTemplate: new Simplate([
            '<div id="{%= $.id %}" title="{%= $.titleText %}" class="overthrow list {%= $.cls %}" {% if ($.resourceKind) { %}data-resource-kind="{%= $.resourceKind %}"{% } %}>',
                '<div data-dojo-attach-point="searchNode"></div>',
                '<div class="overthrow scroller" data-dojo-attach-point="scrollerNode">',
                    '{%! $.emptySelectionTemplate %}',
                    '<ul class="list-content" data-dojo-attach-point="contentNode"></ul>',
                    '{%! $.moreTemplate %}',
                    '{%! $.listActionTemplate %}',
                '</div>',
            '</div>'
        ]),
        /**
         * @property {Simplate}
         * The template used to render the loading message when the view is requesting more data.
         *
         * The default template uses the following properties:
         *
         *      name                description
         *      ----------------------------------------------------------------
         *      loadingText         The text to display while loading.
         */
        loadingTemplate: new Simplate([
            '<li class="list-loading-indicator"><span class="fa fa-spinner fa-spin"></span><div>{%= $.loadingText %}</div></li>'
        ]),
        /**
         * @property {Simplate}
         * The template used to render the pager at the bottom of the view.  This template is not directly rendered, but is
         * included in {@link #viewTemplate}.
         *
         * The default template uses the following properties:
         *
         *      name                description
         *      ----------------------------------------------------------------
         *      moreText            The text to display on the more button.
         *
         * The default template exposes the following actions:
         *
         * * more
         */
        moreTemplate: new Simplate([
            '<div class="list-more" data-dojo-attach-point="moreNode">',
            '<div class="list-remaining"><span data-dojo-attach-point="remainingContentNode"></span></div>',
            '<button class="button" data-action="more">',
            '<span>{%= $.moreText %}</span>',
            '</button>',
            '</div>'
        ]),
        /**
         * @property {Simplate}
         * Template used on lookups to have empty Selection option.
         * This template is not directly rendered but included in {@link #viewTemplate}.
         *
         * The default template uses the following properties:
         *
         *      name                description
         *      ----------------------------------------------------------------
         *      emptySelectionText  The text to display on the empty Selection button.
         *
         * The default template exposes the following actions:
         *
         * * emptySelection
         */
        emptySelectionTemplate: new Simplate([
            '<div class="list-empty-opt" data-dojo-attach-point="emptySelectionNode">',
            '<button class="button" data-action="emptySelection">',
            '<span>{%= $.emptySelectionText %}</span>',
            '</button>',
            '</div>'
        ]),
        /**
         * @property {Simplate}
         * The template used to render a row in the view.  This template includes {@link #itemTemplate}.
         */
        rowTemplate: new Simplate([
            '<li data-action="activateEntry" data-key="{%= $[$$.idProperty] %}" data-descriptor="{%: $[$$.labelProperty] %}">',
                '<button data-action="selectEntry" class="list-item-selector button">',
                    '{% if ($$.selectIconClass) { %}',
                        '<span class="{%= $$.selectIconClass %}"></span>',
                    '{% } else if ($$.icon || $$.selectIcon) { %}',
                        '<img src="{%= $$.icon || $$.selectIcon %}" class="icon" />',
                    '{% } %}',
                '</button>',
                '<div class="list-item-content" data-snap-ignore="true">{%! $$.itemTemplate %}</div>',
                '<div id="list-item-content-related"></div>',
            '</li>'
        ]),
        /**
         * @cfg {Simplate}
         * The template used to render the content of a row.  This template is not directly rendered, but is
         * included in {@link #rowTemplate}.
         *
         * This property should be overridden in the derived class.
         * @template
         */
        itemTemplate: new Simplate([
            '<h3>{%: $[$$.labelProperty] %}</h3>',
            '<h4>{%: $[$$.idProperty] %}</h4>'
        ]),
        /**
         * @property {Simplate}
         * The template used to render a message if there is no data available.
         * The default template uses the following properties:
         *
         *      name                description
         *      ----------------------------------------------------------------
         *      noDataText          The text to display if there is no data.
         */
        noDataTemplate: new Simplate([
            '<li class="no-data">',
            '<h3>{%= $.noDataText %}</h3>',
            '</li>'
        ]),
        /**
         * @property {Simplate}
         * The template used to render the single list action row.
         */
        listActionTemplate: new Simplate([
            '<li data-dojo-attach-point="actionsNode" class="actions-row"></li>'
        ]),
        /**
         * @property {Simplate}
         * The template used to render a list action item.
         * The default template uses the following properties:
         *
         *      name                description
         *      ----------------------------------------------------------------
         *      actionIndex         The correlating index number of the action collection
         *      title               Text used for ARIA-labeling
         *      icon                Relative path to the icon to use
         *      cls                 CSS class to use instead of an icon
         *      id                  Unique name of action, also used for alt image text
         *      label               Text added below the icon
         */
        listActionItemTemplate: new Simplate([
            '<button data-action="invokeActionItem" data-id="{%= $.actionIndex %}" aria-label="{%: $.title || $.id %}">',
                '{% if ($.cls) { %}',
                    '<span class="{%= $.cls %}"></span>',
                '{% } else if ($.icon) { %}',
                    '<img src="{%= $.icon %}" alt="{%= $.id %}" />',
                '{% } else { %}',
                    '<span class="fa fa-level-down fa-2x"></span>',
                '{% } %}',
                '<label>{%: $.label %}</label>',
            '</button>'
        ]),

        /**
         * @property {HTMLElement}
         * Attach point for the main view content
         */
        contentNode: null,
        /**
         * @property {HTMLElement}
         * Attach point for the remaining entries content
         */
        remainingContentNode: null,
        /**
         * @property {HTMLElement}
         * Attach point for the search widget
         */
        searchNode: null,
        /**
         * @property {HTMLElement}
         * Attach point for the empty, or no selection, container
         */
        emptySelectionNode: null,
        /**
         * @property {HTMLElement}
         * Attach point for the remaining entries container
         */
        remainingNode: null,
        /**
         * @property {HTMLElement}
         * Attach point for the request more entries container
         */
        moreNode: null,
        /**
         * @property {HTMLElement}
         * Attach point for the list actions container
         */
        actionsNode: null,

        /**
         * @cfg {String} id
         * The id for the view, and it's main DOM element.
         */
        id: 'generic_list',
        /**
         * @cfg {String}
         * The SData resource kind the view is responsible for.  This will be used as the default resource kind
         * for all SData requests.
         */
        resourceKind: '',
        store: null,
        entries: null,
        /**
         * @property {Number}
         * The number of entries to request per SData payload.
         */
        pageSize: 20,
        /**
         * @property {Boolean}
         * Controls the addition of a search widget.
         */
        enableSearch: true,
        /**
         * @property {Boolean}
         * Flag that determines if the list actions panel should be in use.
         */
        enableActions: false,
        /**
         * @property {Boolean}
         * Controls the visibility of the search widget.
         */
        hideSearch: false,
        /**
         * @property {Boolean}
         * True to allow selections via the SelectionModel in the view.
         */
        allowSelection: false,
        /**
         * @property {Boolean}
         * True to clear the selection model when the view is shown.
         */
        autoClearSelection: true,
        /**
         * @property {String/View}
         * The id of the detail view, or view instance, to show when a row is clicked.
         */
        detailView: null,
        /**
         * @property {String}
         * The view id to show if there is no `insertView` specified, when
         * the {@link #navigateToInsertView} action is invoked.
         */
        editView: null,
        /**
         * @property {String}
         * The view id to show when the {@link #navigateToInsertView} action is invoked.
         */
        insertView: null,
        /**
         * @property {String}
         * The view id to show when the {@link #navigateToContextView} action is invoked.
         */
        contextView: false,
        /**
         * @property {Object}
         * A dictionary of hash tag search queries.  The key is the hash tag, without the symbol, and the value is
         * either a query string, or a function that returns a query string.
         */
        hashTagQueries: null,
        /**
         * The text displayed in the more button.
         * @type {String}
         */
        moreText: 'Retrieve More Records',
        /**
         * @property {String}
         * The text displayed in the emptySelection button.
         */
        emptySelectionText: 'None',
        /**
         * @property {String}
         * The text displayed as the default title.
         */
        titleText: 'List',
        /**
         * @property {String}
         * The error message to display if rendering a row template is not successful.
         */
        errorRenderText: 'Error rendering row template.',
        /**
         * @property {Simplate}
         *
         */
        rowTemplateError: new Simplate([
            '<li data-action="activateEntry" data-key="{%= $[$$.idProperty] %}" data-descriptor="{%: $[$$.labelProperty] %}">',
                '<div class="list-item-content" data-snap-ignore="true">{%: $$.errorRenderText %}</div>',
            '</li>'
        ]),
        /**
         * @property {String}
         * The format string for the text displayed for the remaining record count.  This is used in a {@link String#format} call.
         */
        remainingText: '${0} records remaining',
        /**
         * @property {String}
         * The text displayed on the cancel button.
         * @deprecated
         */
        cancelText: 'Cancel',
        /**
         * @property {String}
         * The text displayed on the insert button.
         * @deprecated
         */
        insertText: 'New',
        /**
         * @property {String}
         * The text displayed when no records are available.
         */
        noDataText: 'no records',
        /**
         * @property {String}
         * The text displayed when data is being requested.
         */
        loadingText: 'loading...',
        /**
         * @property {String}
         * The text displayed when a data request fails.
         */
        requestErrorText: 'A server error occurred while requesting data.',
        /**
         * @property {String}
         * The customization identifier for this class. When a customization is registered it is passed
         * a path/identifier which is then matched to this property.
         */
        customizationSet: 'list',
        /**
         * @property {String}
         * The relative path to the checkmark or select icon for row selector
         */
        selectIcon: '',

        /**
         * @property {String}
         * CSS class to use for checkmark or select icon for row selector. Overrides selectIcon.
         */
        selectIconClass: 'fa fa-check fa-lg',

        /**
         * @property {Object}
         * The search widget instance for the view
         */
        searchWidget: null,
        /**
         * @property {SearchWidget}
         * The class constructor to use for the search widget
         */
        searchWidgetClass: SearchWidget,

        /**
         * @property {Boolean}
         * Flag to indicate the default search term has been set.
         */
        defaultSearchTermSet: false,

        /**
         * @property {String}
         * The default search term to use
         */
        defaultSearchTerm: '',
        /**
         * @property {Object}
         * The selection model for the view
         */
        _selectionModel: null,
        /**
         * @property {Object}
         * The selection event connections
         */
        _selectionConnects: null,
        /**
         * @property {Object}
         * The toolbar layout definition for all toolbar entries.
         */
        tools: null,
        /**
         * The list action layout definition for the list action bar.
         */
        actions: null,

        /**
         * @property {Boolean} If true, will remove the loading button and auto fetch more data when the user scrolls to the bottom of the page.
         */
        continuousScrolling: true,

        /**
         * @property {Boolean} Indicates if the list is loading
         */
        listLoading: false,

        /**
         * The related view definitions for related views for each row.
         */
        relatedViews: null,

        /**
         * The related view managers for each related view definition.
         */
        relatedViewManagers: null,

        // Store properties
        itemsProperty: '',
        idProperty: '',
        labelProperty: '',
        entityProperty: '',
        versionProperty: '',

        /**
         * Setter method for the selection model, also binds the various selection model select events
         * to the respective List event handler for each.
         * @param {SelectionModel} selectionModel The selection model instance to save to the view
         * @private
         */
        _setSelectionModelAttr: function(selectionModel) {
            if (this._selectionConnects) {
                array.forEach(this._selectionConnects, this.disconnect, this);
            }

            this._selectionModel = selectionModel;
            this._selectionConnects = [];

            if (this._selectionModel) {
                this._selectionConnects.push(
                    this.connect(this._selectionModel, 'onSelect', this._onSelectionModelSelect),
                    this.connect(this._selectionModel, 'onDeselect', this._onSelectionModelDeselect),
                    this.connect(this._selectionModel, 'onClear', this._onSelectionModelClear)
                );
            }
        },
        /**
         * Getter nmethod for the selection model
         * @return {SelectionModel}
         * @private
         */
        _getSelectionModelAttr: function() {
            return this._selectionModel;
        },
        /**
         * Extends dijit Widget postCreate to setup the selection model, search widget and bind
         * to the global refresh publish
         */
        _onScrollHandle: null,
        constructor: function() {
            this.entries = {};
        },
        postCreate: function() {
            this.inherited(arguments);

            if (this._selectionModel === null) {
                this.set('selectionModel', new ConfigurableSelectionModel());
            }
            this.subscribe('/app/refresh', this._onRefresh);

            if (this.enableSearch) {
                var searchWidgetCtor = lang.isString(this.searchWidgetClass)
                    ? lang.getObject(this.searchWidgetClass, false)
                    : this.searchWidgetClass;

                this.searchWidget = this.searchWidget || new searchWidgetCtor({
                    'class': 'list-search',
                    'owner': this,
                    'onSearchExpression': this._onSearchExpression.bind(this)
                });
                this.searchWidget.placeAt(this.searchNode, 'replace');
            } else {
                this.searchWidget = null;
            }

            domClass.toggle(this.domNode, 'list-hide-search', this.hideSearch);
            this.clear();
        },
        /**
         * Called on application startup to configure the search widget if present and create the list actions.
         */
        startup: function() {
            this.inherited(arguments);

            if (this.searchWidget) {
                this.searchWidget.configure({
                    'hashTagQueries': this._createCustomizedLayout(this.createHashTagQueryLayout(), 'hashTagQueries'),
                    'formatSearchQuery': this.formatSearchQuery.bind(this)
                });
            }

            this.createActions(this._createCustomizedLayout(this.createActionLayout(), 'actions'));
            this.relatedViews = this._createCustomizedLayout(this.createRelatedViewLayout(), 'relatedViews');
        },
        /**
         * Extends dijit Widget to destroy the search widget before destroying the view.
         */
        destroy: function() {
            if (this.searchWidget) {
                if(!this.searchWidget._destroyed) {
                    this.searchWidget.destroyRecursive();
                }

                delete this.searchWidget;
            }

            delete this.store;
            this.destroyRelatedViewWidgets();
            this.inherited(arguments);
        },
        _getStoreAttr: function() {
            return this.store || (this.store = this.createStore());
        },
        /**
        * Shows overrides the view class to set options for the list view and then calls the inherited show method on the view.
        * @param {Object} options The navigation options passed from the previous view.
        * @param transitionOptions {Object} Optional transition object that is forwarded to ReUI.
        */
        show: function(options, transitionOptions) {
            if (options){
               if (options.resetSearch) {
                   this.defaultSearchTermSet = false;
               }
            }
            this.inherited(arguments);
        },
        /**
         * Sets and returns the toolbar item layout definition, this method should be overriden in the view
         * so that you may define the views toolbar entries.
         * @return {Object} this.tools
         * @template
         */
        createToolLayout: function() {
            return this.tools || (this.tools = {
                'tbar': [{
                    id: 'new',
                    cls: 'fa fa-plus fa-fw fa-lg',
                    action: 'navigateToInsertView',
                    security: App.getViewSecurity(this.insertView, 'insert')
                }]
            });
        },
        /**
         * Sets and returns the list-action actions layout definition, this method should be overriden in the view
         * so that you may define the action entries for that view.
         * @return {Object} this.acttions
         */
        createActionLayout: function() {
            return this.actions || {};
        },
        /**
         * Creates the action bar and adds it to the DOM. Note that it replaces `this.actions` with the passed
         * param as the passed param should be the result of the customization mixin and `this.actions` needs to be the
         * final actions state.
         * @param {Object[]} actions
         */
        createActions: function(actions) {
            for (var i = 0; i < actions.length; i++) {
                var action = actions[i],
                    options = {
                        actionIndex: i,
                        hasAccess: (!actions.security || (action.security && App.hasAccessTo(this.expandExpression(action.security)))) ? true : false
                    },
                    actionTemplate = action.template || this.listActionItemTemplate;

                lang.mixin(action, options);

                domConstruct.place(actionTemplate.apply(action, action.id), this.actionsNode, 'last');
            }

            this.actions = actions;
        },
        selectEntrySilent: function(key) {
            var enableActions = this.enableActions,// preserve the original value
                selectionModel = this.get('selectionModel'),
                selectedItems,
                selection,
                prop;

            if (key) {
                this.enableActions = false; // Set to false so the quick actions menu doesn't pop up
                selectionModel.clear();
                selectionModel.toggle(key, this.entries[key]);
                selectedItems = selectionModel.getSelections();
                this.enableActions = enableActions;

                // We know we are single select, so just grab the first selection
                for (prop in selectedItems) {
                    selection = selectedItems[prop];
                    break;
                }
            }

            return selection;
        },
        invokeActionItemBy: function(actionPredicate, key) {
            var actions, selection;

            actions = array.filter(this.actions, actionPredicate);
            selection = this.selectEntrySilent(key);
            this.checkActionState();
            array.forEach(actions, function(action) {
                this._invokeAction(action, selection);
            }, this);
        },
        /**
         * This is the data-action handler for list-actions, it will locate the action instance viw the data-id attribute
         * and invoke either the `fn` with `scope` or the named `action` on the current view.
         *
         * The resulting function being called will be passed not only the action item definition but also
         * the first (only) selection from the lists selection model.
         *
         * @param {Object} parameters Collection of data- attributes already gathered from the node
         * @param {Event} evt The click/tap event
         * @param {HTMLElement} node The node that invoked the action
         */
        invokeActionItem: function(parameters, evt, node) {
            var index = parameters['id'],
                action = this.actions[index],
                selectedItems = this.get('selectionModel').getSelections(),
                selection = null;


            for (var key in selectedItems) {
                selection = selectedItems[key];
                break;
            }

            this._invokeAction(action, selection);
        },
        _invokeAction: function(action, selection) {
            if (!action.isEnabled) {
                return;
            }

            if (action['fn']) {
                action['fn'].call(action['scope'] || this, action, selection);
            } else {
                if (action['action']) {
                    if (this.hasAction(action['action'])) {
                        this.invokeAction(action['action'], action, selection);
                    }
                }
            }
        },
        /**
         * Called when showing the action bar for a newly selected row, it sets the disabled state for each action
         * item using the currently selected row as context by passing the action instance the selected row to the
         * action items `enabled` property.
         */
        checkActionState: function() {
            var selectedItems = this.get('selectionModel').getSelections(),
                selection = null, key;

            for (key in selectedItems) {
                selection = selectedItems[key];
                break;
            }
            this._applyStateToActions(selection);
           
        },
        /**
         * Called from checkActionState method and sets the state of the actions from what was selected from the selected row, it sets the disabled state for each action
         * item using the currently selected row as context by passing the action instance the selected row to the
         * action items `enabled` property.
         * @param {Object} selection 
         */
        _applyStateToActions: function(selection) {
            var i, action;
            // IE10 is destroying the child notes of the actionsNode when the list view refreshes,
            // re-create the action DOM before moving on.
            if (this.actionsNode.childNodes.length === 0 && this.actions.length > 0) {
                this.createActions(this._createCustomizedLayout(this.createActionLayout(), 'actions'));
            }

            for (i = 0; i < this.actions.length; i++) {
                action = this.actions[i];

                action.isEnabled = (typeof action['enabled'] === 'undefined')
                    ? true
                    : this.expandExpression(action['enabled'], action, selection);

                if (!action.hasAccess) {
                    action.isEnabled = false;
                }

                if (this.actionsNode.childNodes[i]) {
                    domClass.toggle(this.actionsNode.childNodes[i], 'toolButton-disabled', !action.isEnabled);
                }
            }
        },
        /**
         * Handler for showing the list-action panel/bar - it needs to do several things:
         *
         * 1. Check each item for context-enabledment
         * 1. Move the action panel to the current row and show it
         * 1. Adjust the scrolling if needed (if selected row is at bottom of screen, the action-bar shows off screen
         * which is bad)
         *
         * @param {HTMLElement} rowNode The currently selected row node
         */
        showActionPanel: function(rowNode) {
            this.checkActionState();
            domClass.add(rowNode, 'list-action-selected');

            this.onApplyRowActionPanel(this.actionsNode, rowNode);

            domConstruct.place(this.actionsNode, rowNode, 'after');
        },
        onApplyRowActionPanel: function(actionNodePanel, rowNode) {

        },
        /**
         * Sets the `this.options.source` to passed param after adding the views resourceKind. This function is used so
         * that when the next view queries the navigation context we can include the passed param as a data point.
         *
         * @param {Object} source The object to set as the options.source.
         */
        setSource: function(source) {
            lang.mixin(source, {
                resourceKind: this.resourceKind
            });

            this.options.source = source;
        },
        /**
         * Hides the passed list-action row/panel by removing the selected styling
         * @param {HTMLElement} rowNode The currently selected row.
         */
        hideActionPanel: function(rowNode) {
            domClass.remove(rowNode, 'list-action-selected');
        },
        /**
         * Determines if the view is a navigatible view or a selection view by returning `this.selectionOnly` or the
         * navigation `this.options.selectionOnly`.
         * @return {Boolean}
         */
        isNavigationDisabled: function() {
            return ((this.options && this.options.selectionOnly) || (this.selectionOnly));
        },
        /**
         * Determines if the selections are disabled by checking the `allowSelection` and `enableActions`
         * @return {Boolean}
         */
        isSelectionDisabled: function() {
            return !((this.options && this.options.selectionOnly) || this.enableActions || this.allowSelection);
        },
        /**
         * Handler for when the selection model adds an item. Adds the selected state to the row or shows the list
         * actions panel.
         * @param {String} key The extracted key from the selected row.
         * @param {Object} data The actual row's matching data point
         * @param {String/HTMLElement} tag An indentifier, may be the actual row node or some other id.
         * @private
         */
        _onSelectionModelSelect: function(key, data, tag) {
            var node = dom.byId(tag) || query('li[data-key="'+key+'"]', this.contentNode)[0];
            if (!node) {
                return;
            }

            if (this.enableActions) {
                this.showActionPanel(node);
                return;
            }

            domClass.add(node, 'list-item-selected');
        },
        /**
         * Handler for when the selection model removes an item. Removes the selected state to the row or hides the list
         * actions panel.
         * @param {String} key The extracted key from the de-selected row.
         * @param {Object} data The actual row's matching data point
         * @param {String/HTMLElement} tag An indentifier, may be the actual row node or some other id.
         * @private
         */
        _onSelectionModelDeselect: function(key, data, tag) {
            var node = dom.byId(tag) || query('li[data-key="'+key+'"]', this.contentNode)[0];
            if (!node) {
                return;
            }

            if (this.enableActions) {
                this.hideActionPanel(node);
                return;
            }

            domClass.remove(node, 'list-item-selected');
        },
        /**
         * Handler for when the selection model clears the selections.
         * @private
         */
        _onSelectionModelClear: function() {
        },
        /**
         * Attempts to activate entries passed in `this.options.previousSelections` where previousSelections is an array
         * of data-keys or data-descriptors to search the list rows for.
         * @private
         */
        _loadPreviousSelections: function() {
            var previousSelections = this.options && this.options.previousSelections;
            if (previousSelections) {
                for (var i = 0; i < previousSelections.length; i++) {
                    var row = query((string.substitute('[data-key="${0}"], [data-descriptor="${0}"]', [previousSelections[i]])), this.contentNode)[0];

                    if (row) {
                        this.activateEntry({
                            key: previousSelections[i],
                            descriptor: previousSelections[i],
                            $source: row
                        });
                    }
                }
            }
        },
        /**
         * Handler for the global `/app/refresh` event. Sets `refreshRequired` to true if the resourceKind matches.
         * @param {Object} options The object published by the event.
         * @private
         */
        _onRefresh: function(options) {
        },
        onScroll: function(evt) {
            var pos, height, scrollTop, scrollHeight, remaining, selected, diff, scrollerNode;
            scrollerNode = this.get('scroller');
            pos = domGeom.position(scrollerNode, true);

            height = pos.h; // viewport height (what user sees)
            scrollHeight = scrollerNode.scrollHeight; // Entire container height
            scrollTop = scrollerNode.scrollTop; // How far we are scrolled down
            remaining = scrollHeight - scrollTop; // Height we have remaining to scroll

            selected = domAttr.get(this.domNode, 'selected');

            diff = Math.abs(remaining - height);

            // Start auto fetching more data if the user is on the last half of the remaining screen
            if (diff <= height / 2) {
                if (selected === 'true' && this.hasMoreData() && !this.listLoading) {
                    this.more();
                }
            }
        },
        /**
         * Handler for the select or action node data-action. Finds the nearest node with the data-key attribute and
         * toggles it in the views selection model.
         *
         * If singleSelectAction is defined, invoke the singleSelectionAction.
         *
         * @param {Object} params Collection of `data-` attributes from the node.
         * @param {Event} evt The click/tap event.
         * @param {HTMLElement} node The element that initiated the event.
         */
        selectEntry: function(params, evt, node) {
            var row = query(node).closest('[data-key]')[0],
                key = row ? row.getAttribute('data-key') : false;

            if (this._selectionModel && key) {
                this._selectionModel.toggle(key, this.entries[key], row);
            }

            if (this.options.singleSelect && this.options.singleSelectAction && !this.enableActions) {
                this.invokeSingleSelectAction();
            }
        },
        /**
         * Handler for each row.
         *
         * If a selection model is defined and navigation is disabled then toggle the entry/row
         * in the model and if singleSelectionAction is true invoke the singleSelectAction.
         *
         * Else navigate to the detail view for the extracted data-key.
         *
         * @param {Object} params Collection of `data-` attributes from the node.
         */
        activateEntry: function(params) {
            if (params.key)
            {
                if (this._selectionModel && this.isNavigationDisabled()) {
                    this._selectionModel.toggle(params.key, this.entries[params.key] || params.descriptor, params.$source);
                    if (this.options.singleSelect && this.options.singleSelectAction) {
                        this.invokeSingleSelectAction();
                    }
                } else {
                    this.navigateToDetailView(params.key, params.descriptor);
                }
            }
        },
        /**
         * Invokes the corresponding top toolbar tool using `this.options.singleSelectAction` as the name.
         * If autoClearSelection is true, clear the selection model.
         */
        invokeSingleSelectAction: function() {
            if (App.bars['tbar']) {
                App.bars['tbar'].invokeTool({ tool: this.options.singleSelectAction });
            }

            if (this.autoClearSelection) {
                this._selectionModel.clear();
            }
        },
        /**
         * Called to transform a textual query into an SData query compatible search expression.
         *
         * Views should override this function to provide their own formatting tailored to their entity.
         *
         * @param {String} searchQuery User inputted text from the search widget.
         * @return {String/Boolean} An SData query compatible search expression.
         * @template
         */
        formatSearchQuery: function(searchQuery) {
            return false;
        },
        /**
         * Replaces a single `"` with two `""` for proper SData query expressions.
         * @param {String} searchQuery Search expression to be escaped.
         * @return {String}
         */
        escapeSearchQuery: function(searchQuery) {
            return Utility.escapeSearchQuery(searchQuery);
        },
        /**
         * Handler for the search widgets search.
         *
         * Prepares the view by clearing it and setting `this.query` to the given search expression. Then calls
         * {@link #requestData requestData} which start the request process.
         *
         * @param {String} expression String expression as returned from the search widget
         * @private
         */
        _onSearchExpression: function(expression) {
            this.clear(false);
            this.queryText = '';
            this.query = expression;

            this.requestData();
        },
        /**
         * Sets the default search expression (acting as a pre-filter) to `this.options.query` and configures the
         * search widget by passing in the current view context.
         */
        configureSearch: function() {
            this.query = this.options && this.options.query || this.query || null;
            if (this.searchWidget) {
                this.searchWidget.configure({
                    'context': this.getContext()
                });
            }

            this._setDefaultSearchTerm();
        },
        _setDefaultSearchTerm: function() {
            if (!this.defaultSearchTerm || this.defaultSearchTermSet) {
                return;
            }

            var searchQuery;
            if (typeof this.defaultSearchTerm === 'function') {
                this.setSearchTerm(this.defaultSearchTerm());
            } else {
                this.setSearchTerm(this.defaultSearchTerm);
            }

            searchQuery = this.getSearchQuery();
            if (searchQuery) {
                this.query = searchQuery;
            } else {
                this.query = '';
            }

            this.defaultSearchTermSet = true;
        },
        getSearchQuery:function(){
            if (this.searchWidget) {
                return this.searchWidget.getFormattedSearchQuery();
            }
            return null;
        },
        /**
         * Helper method for list actions. Takes a view id, data point and where format string, sets the nav options
         * `where` to the formatted expression using the data point and shows the given view id with that option.
         * @param {Object} action Action instance, not used.
         * @param {Object} selection Data entry for the selection.
         * @param {String} viewId View id to be shown
         * @param {String} whereQueryFmt Where expression format string to be passed. `${0}` will be the `idProperty`
         * property of the passed selection data.
         */
        navigateToRelatedView:  function(action, selection, viewId, whereQueryFmt) {
            var view = App.getView(viewId),
                options = {
                    where: string.substitute(whereQueryFmt, [selection.data[this.idProperty]])
                };

            this.setSource({
                entry: selection.data,
                descriptor: selection.data[this.labelProperty],
                key: selection.data[this.idProperty]
            });

            if (view && options) {
                view.show(options);
            }
        },
        /**
         * Navigates to the defined `this.detailView` passing the params as navigation options.
         * @param {String} key Key of the entry to be shown in detail
         * @param {String} descriptor Description of the entry, will be used as the top toolbar title text.
         */
        navigateToDetailView: function(key, descriptor) {
            var view = App.getView(this.detailView);
            if (view) {
                view.show({
                    descriptor: descriptor, // keep for backwards compat
                    title: descriptor,
                    key: key
                });
            }
        },
        /**
         * Helper method for list-actions. Navigates to the defined `this.editView` passing the given selections `idProperty`
         * property in the navigation options (which is then requested and result used as default data).
         * @param {Object} action Action instance, not used.
         * @param {Object} selection Data entry for the selection.
         */
        navigateToEditView: function(action, selection) {
            var view = App.getView(this.editView || this.insertView),
                key = selection.data[this.idProperty];
            if (view) {
                view.show({
                    key: key
                });
            }
        },
        /**
         * Navigates to the defined `this.insertView`, or `this.editView` passing the current views id as the `returnTo`
         * option and setting `insert` to true.
         * @param {HTMLElement} el Node that initiated the event.
         */
        navigateToInsertView: function(el) {
            var view = App.getView(this.insertView || this.editView);
            if (view) {
                view.show({
                    returnTo: this.id,
                    insert: true
                });
            }
        },
        /**
         * Deterimines if there is more data to be shown.
         * @return {Boolean} True if the list has more data; False otherwise. Default is true.
         */
        hasMoreData: function() {
        },
        /**
         * Initiates the data request.
         */
        requestData: function() {
            var store, queryOptions, request;

            domClass.add(this.domNode, 'list-loading');
            this.listLoading = true;

            store = this.get('store');
            if (store) {
                // attempt to use a dojo store
                queryOptions = {
                        count: this.pageSize,
                        start: this.position
                };

                this._applyStateToQueryOptions(queryOptions);

                var queryExpression = this._buildQueryExpression() || null,
                    queryResults = store.query(queryExpression, queryOptions);

                when(queryResults,
                    this._onQueryComplete.bind(this, queryResults),
                    this._onQueryError.bind(this, queryOptions)
                );

                return queryResults;
            }

            console.warn('Error requesting data, no store was defined. Did you mean to mixin _SDataListMixin to your list view?');
        },
        _onQueryComplete: function(queryResults, entries) {
            try {
                var start = this.position, scrollerNode = this.get('scroller');

                when(queryResults.total, this._onQueryTotal.bind(this));

                /* todo: move to a more appropriate location */
                if (this.options && this.options.allowEmptySelection) {
                    domClass.add(this.domNode, 'list-has-empty-opt');
                }

                /* remove the loading indicator so that it does not get re-shown while requesting more data */
                if (start === 0) {
                    // Check entries.length so we don't clear out the "noData" template
                    if (entries.length > 0) {
                        this.set('listContent', '');
                    }

                    domConstruct.destroy(this.loadingIndicatorNode);
                }

                this.processData(entries);

                domClass.remove(this.domNode, 'list-loading');
                this.listLoading = false;

                if (!this._onScrollHandle && this.continuousScrolling) {
                    this._onScrollHandle = this.connect(scrollerNode, 'onscroll', this.onScroll);
                }

                this.onContentChange();
                connect.publish('/app/toolbar/update', []);

                if (this._selectionModel) {
                    this._loadPreviousSelections();
                }
            } catch (e) {
                console.error(e);
            }
        },
        createStore: function () {
            return null;
        },
        onContentChange: function() {
        },
        _processEntry: function(entry) {
            return entry;
        },
        _onQueryTotal: function(size) {
            var remaining;

            this.total = size;
            if (size === 0) {
                this.set('listContent', this.noDataTemplate.apply(this));
            } else {
                remaining = this.getRemainingCount();
                if (remaining !== -1) {
                    this.set('remainingContent', string.substitute(this.remainingText, [remaining]));
                    this.remaining = remaining;
                }

                domClass.toggle(this.domNode, 'list-has-more', (remaining === -1 || remaining > 0));

                this.position = this.position + this.pageSize;
            }
        },
        getRemainingCount: function() {
            var remaining = this.total > -1
                ? this.total - (this.position + this.pageSize)
                : -1;

            return remaining;
        },
        onApplyRowTemplate: function(entry, rowNode) {
        },
        processData: function(entries) {
            var store = this.get('store'),
                rowNode,
                output,
                docfrag,
                key,
                entry,
                i,
                count = entries.length;

            if (count > 0) {
                output = [];

                docfrag = document.createDocumentFragment();
                for (i = 0; i < count; i++) {
                    entry = this._processEntry(entries[i]);
                    // If key comes back with nothing, check that the store is properly
                    // setup with an idProperty
                    key = store.getIdentity(entry);
                    this.entries[store.getIdentity(entry)] = entry;

                    try {
                        rowNode = domConstruct.toDom(this.rowTemplate.apply(entry, this));
                    } catch (err) {
                        console.error(err);
                        rowNode = domConstruct.toDom(this.rowTemplateError.apply(entry, this));
                    }

                    docfrag.appendChild(rowNode);
                    this.onApplyRowTemplate(entry, rowNode);
                    if (this.relatedViews.length > 0) {
                        this.onProcessRelatedViews(entry, rowNode, entries);
                    }
                }

                if (docfrag.childNodes.length > 0) {
                    domConstruct.place(docfrag, this.contentNode, 'last');
                }
            }
        },
        /**
         * Gets the related view mnagager for a related view definition.
         * If a manager is not found a new Related View Manager is created and returned.
         * @return {Object} RelatedViewManager
         */
       getRelatedViewManager: function(relatedView) {
            var relatedViewManager, options;
            if (!this.relatedViewManagers){
                this.relatedViewManagers = {};
            }
            if (this.relatedViewManagers[relatedView.id]) {
                relatedViewManager = this.relatedViewManagers[relatedView.id];
            } else {
                options = { id:relatedView.id,
                    relatedViewConfig: relatedView
                };
                relatedViewManager = new RelatedViewManager(options);
                this.relatedViewManagers[relatedView.id] = relatedViewManager;
            }
            return relatedViewManager;
       },
        /**
         *
         * Add the each entry and row to the RelateView manager wich in turn creates the new related view and renders its content with in the current row.`
         *
         * @param {Object} entry the current entry from the data.
         * @param {Object} rownode the current dom node to add the widget to.
         * @param {Object} entries the data.
         */
        onProcessRelatedViews: function(entry, rowNode, entries) {
            var relatedViewManager,i;
            if (this.options && this.options.simpleMode && (this.options.simpleMode === true)) {
                return;
            }
            if (this.relatedViews.length > 0) {
                try {
                    for (i = 0; i < this.relatedViews.length; i++) {
                        if (this.relatedViews[i].enabled) {
                            relatedViewManager = this.getRelatedViewManager(this.relatedViews[i]);
                            if (relatedViewManager) {
                                relatedViewManager.addView(entry, rowNode);
                            }
                        }
                    }
                }
                catch (error) {
                    console.log('Error processing related views:' + error );

                }
            }
        },
        _onQueryError: function(queryOptions, error) {
            if (error.aborted) {
                this.options = false; // force a refresh
            } else {
                alert(string.substitute(this.requestErrorText, [error]));
            }

            var errorItem = {
                viewOptions: this.options,
                serverError: error
            };
            ErrorManager.addError(this.requestErrorText, errorItem);

            domClass.remove(this.domNode, 'list-loading');
        },
        _buildQueryExpression: function() {
            return lang.mixin(this.query || {}, this.options && (this.options.query || this.options.where));
        },
        _applyStateToQueryOptions: function(queryOptions) {
        },
        /**
         * Handler for the more button. Simply calls {@link #requestData requestData} which already has the info for
         * setting the start index as needed.
         */
        more: function() {
            if (this.continuousScrolling) {
                this.set('remainingContent', this.loadingTemplate.apply(this));
            }

            this.requestData();
        },
        /**
         * Handler for the none/no selection button is pressed. Used in selection views when not selecting is an option.
         * Invokes the `this.options.singleSelectAction` tool.
         */
        emptySelection: function() {
            this._selectionModel.clear();

            if (App.bars['tbar']) {
                App.bars['tbar'].invokeTool({ tool: this.options.singleSelectAction }); // invoke action of tool
            }
        },
        /**
         * Determines if the view should be refresh by inspecting and comparing the passed navigation options with current values.
         * @param {Object} options Passed navigation options.
         * @return {Boolean} True if the view should be refreshed, false if not.
         */
        refreshRequiredFor: function(options) {
            if (this.options) {
                if (options) {
                    if (this.expandExpression(this.options.stateKey) != this.expandExpression(options.stateKey)) {
                        return true;
                    }
                    if (this.expandExpression(this.options.where) != this.expandExpression(options.where)) {
                        return true;
                    }
                    if (this.expandExpression(this.options.query) != this.expandExpression(options.query)) {
                        return true;
                    }
                    if (this.expandExpression(this.options.resourceKind) != this.expandExpression(options.resourceKind)) {
                        return true;
                    }
                    if (this.expandExpression(this.options.resourcePredicate) != this.expandExpression(options.resourcePredicate)) {
                        return true;
                    }
                }

                return false;
            } else {
                return this.inherited(arguments);
            }
        },
        /**
         * Returns the current views context by expanding upon the {@link View#getContext parent implementation} to include
         * the views resourceKind.
         * @return {Object} context.
         */
        getContext: function() {
            return this.inherited(arguments);
        },
        /**
         * Extends the {@link View#beforeTransitionTo parent implementation} by also toggling the visibility of the views
         * components and clearing the view and selection model as needed.
         */
        beforeTransitionTo: function() {
            this.inherited(arguments);

            domClass.toggle(this.domNode, 'list-hide-search', (this.options && typeof this.options.hideSearch !== 'undefined')
                ? this.options.hideSearch
                : this.hideSearch);

            domClass.toggle(this.domNode, 'list-show-selectors', !this.isSelectionDisabled() && !this.options.singleSelect);

            if (this._selectionModel && !this.isSelectionDisabled()) {
                this._selectionModel.useSingleSelection(this.options.singleSelect);
            }

            if (typeof this.options.enableActions !== 'undefined') {
                this.enableActions = this.options.enableActions;
            }

            domClass.toggle(this.domNode, 'list-show-actions', this.enableActions);
            if (this.enableActions) {
                this._selectionModel.useSingleSelection(true);
            }


            if (this.refreshRequired) {
                this.clear();
            } else  {
                // if enabled, clear any pre-existing selections
                if (this._selectionModel && this.autoClearSelection && !this.enableActions) {
                    this._selectionModel.clear();
                }
            }
        },
        /**
         * Extends the {@link View#transitionTo parent implementation} to also configure the search widget and
         * load previous selections into the selection model.
         */
        transitionTo: function()
        {
            this.configureSearch();

            if (this._selectionModel) {
                this._loadPreviousSelections();
            }
            
            this.inherited(arguments);
        },
        /**
         * Generates the hash tag layout by taking the hash tags defined in `this.hashTagQueries` and converting them
         * into individual objects in an array to be used in the customization engine.
         * @return {Object[]}
         */
        createHashTagQueryLayout: function() {
            // todo: always regenerate this layout? always regenerating allows for all existing customizations
            // to still work, at expense of potential (rare) performance issues if many customizations are registered.
            var layout = [];
            for (var name in this.hashTagQueries) {
                layout.push({
                    'key': name,
                    'tag': (this.hashTagQueriesText && this.hashTagQueriesText[name]) || name,
                    'query': this.hashTagQueries[name]
                });
            }
            return layout;
            
        },
        /**
         * Called when the view needs to be reset. Invokes the request data process.
         */
        refresh: function() {
            this.requestData();
        },
        /**
         * Clears the view by:
         *
         *  * clearing the selection model, but without it invoking the event handlers;
         *  * clears the views data such as `this.entries` and `this.entries`;
         *  * clears the search width if passed true; and
         *  * applies the default template.
         *
         * @param {Boolean} all If true, also clear the search widget.
         */
        clear: function(all) {
            if (this._selectionModel) {
                this._selectionModel.suspendEvents();
                this._selectionModel.clear();
                this._selectionModel.resumeEvents();
            }

            this.requestedFirstPage = false;
            this.entries = {};
            this.position = 0;

            if (this._onScrollHandle) {
                this.disconnect(this._onScrollHandle);
                this._onScrollHandle = null;
            }

            if (all === true && this.searchWidget) {
                this.searchWidget.clear();
                this.query = false; // todo: rename to searchQuery
                this.hasSearched = false;
            }

            domClass.remove(this.domNode, 'list-has-more');

            this.set('listContent', this.loadingTemplate.apply(this));
            this.destroyRelatedViewWidgets();
        },
        search: function() {
            if (this.searchWidget) {
                this.searchWidget.search();
            }
        },
        /**
        * Sets the query value on the serach widget
        */
        setSearchTerm: function(value) {
            if (this.searchWidget) {
                this.searchWidget.set('queryValue', value);
            }
        },
        /**
         * Sets and returns the related view definition, this method should be overriden in the view
         * so that you may define the related views that will be add to each row in the list.
         * @return {Object} this.relatedViews
         */
        createRelatedViewLayout: function() {
            return this.relatedViews || (this.relatedViews = {});
        },
        /**
         *  Destroies all of the realted view widgets, that was added.
         */
        destroyRelatedViewWidgets: function() {
            if (this.relatedViewManagers) {
                for (var relatedViewId in this.relatedViewManagers) {
                    this.relatedViewManagers[relatedViewId].destroyViews();
                }
            }
        },
        /**
         * Returns a promise with the list's count.
         */
        getListCount: function(options, callback) {
        }
    });
});
 
