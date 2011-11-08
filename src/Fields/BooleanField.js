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

define('Sage/Platform/Mobile/Fields/BooleanField', ['Sage/Platform/Mobile/Fields/_Field'], function() {
    var control = dojo.declare('Sage.Platform.Mobile.Fields.BooleanField', [Sage.Platform.Mobile.Fields._Field], {
        widgetTemplate: new Simplate([
            '<label for="{%= $.name %}">{%: $.label %}</label>',
            '<div class="toggle" data-dojo-attach-point="toggleNode" data-dojo-attach-event="onclick:onClick" toggled="{%= !!$.checked %}">',
            '<span class="thumb"></span>',
            '<span class="toggleOn">{%= $.onText %}</span>',
            '<span class="toggleOff">{%= $.offText %}</span>',
            '</div>'
        ]),        
        onText: 'ON',
        offText: 'OFF',
        attributeMap: {
            toggled:{
                node: 'toggleNode',
                type: 'attribute',
                attribute: 'toggled'
            }
        },
        onClick: function(evt) {
            if (this.isDisabled()) return;

            var toggledValue = !this.getValue();

            this.setValue(toggledValue);

            this.change(toggledValue, this);
        },
        getValue: function() {
            return (dojo.attr(this.toggleNode, 'toggled') === 'true');
        },
        setValue: function(val, initial) {
            val = typeof val === 'string'
                ? /^true$/i.test(val)
                : !!val;

            if (initial) this.originalValue = val;

            this.set('toggled', val.toString());
        },
        clearValue: function(flag) {
            var initial = flag !== true;

            this.setValue(this.checked, initial);
        },
        isDirty: function() {
            return (this.originalValue != this.getValue());
        }
    });

    return Sage.Platform.Mobile.FieldManager.register('boolean', control);
});