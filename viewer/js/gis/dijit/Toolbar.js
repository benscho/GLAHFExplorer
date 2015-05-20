define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
	'dijit/form/Button',
	'dijit/form/ComboButton',
	'dijit/form/Select',
	'dijit/form/TextBox',
	'dijit/registry',
	'dijit/form/ValidationTextBox',
	
	'dstore/Memory',
	
	'esri/dijit/Measurement',
	'esri/units',
	
	'dojo/dom-style',
	'dojo/dom-construct',
	'dojo/request',
	'dojo/html',
	'dojo/_base/lang',
	'dojo/topic',
	'dojo/text!./Toolbar/Templates/Toolbar.html',
	'./Identify',
	'./Find'
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Button, ComboButton, Select, TextBox, 
			 registry, ValidationTextBox, Memory, Measurement, units, domStyle, domConstruct, request, html, lang, topic, ToolbarTemplate, Identify, Find) {
	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		widgetsInTemplate: true,
        templateString: ToolbarTemplate,
		isActive: false,
		postCreate: function () {
			topic.subscribe('mapClickMode/currentSet', lang.hitch(this, 'setMapClickMode', 'toolbar'));
			//TODO: clean up loading find and identify, fix identify mapClickMode
			this.identify = new Identify({
				include: true,
				id: 'identify',
				type: 'titlePane',
				path: 'gis/dijit/Identify',
				title: 'Identify',
				open: false,
				position: 3,
				options: 'config/identify',
				map: this.map,
				layerInfos: this.layerInfos,
				identifyTolerance: 5
			});
			this.identify.setMapClickMode("identify");
			this.identify.startup();
			this.find = new Find({
				include: true,
				id: 'find',
				type: 'titlePane',
				canFloat: true,
				path: 'gis/dijit/Find',
				title: 'Find',
				open: false,
				position: 3,
				options: 'config/find',
				map: this.map,
				queries: [
					{
						description: 'This is a placeholder query',
						url: 'https://arcgisdev.lsa.umich.edu/arcgis/rest/services/IFR/glahf_subbasins/MapServer',
						layerIds: [0],
						searchFields: ['SUBBASIN'],
						minChars: 2
					}, {
						description: 'A second placeholder query',
						url: 'https://arcgisdev.lsa.umich.edu/arcgis/rest/services/IFR/glahf_subbasins/MapServer',
						layerIds: [0],
						searchFields: ['SUBBASIN'],
						minChars: 2
					}
				]
			});
			this.find.startup();
		},
		startMeasure: function () {
			this.clearContents();
			this.measure = new Measurement({
                map: this.map,
                defaultAreaUnit: units.SQUARE_MILES,
                defaultLengthUnit: units.MILES
            }, domConstruct.create('div'));
			this.measure.placeAt(dojo.byId("toolbarContents"));
            this.measure.startup();
			/*request.get("/js/gis/dijit/Toolbar/Templates/Measure.html").then(function(results) {
				html.set(dojo.byId("toolbarContents"), results);
			});*/
			this.isActive = true;
			this.changeHeight();
		},
		startIdentify: function () {
			this.clearContents();
			this.isActive = true;
			this.changeHeight();
			this.identify.placeAt(dojo.byId("toolbarContents"));
		},
		startFind: function () {
			this.clearContents();
			this.isActive = true;
			this.changeHeight();
			this.find.placeAt(dojo.byId("toolbarContents"));
		},
		startPrint: function () {
			this.clearContents();
			this.isActive = true;
			this.changeHeight();
		},
		clearContents: function () {
			dojo.byId("toolbarContents").innerHTML = "";
			if(this.measure){
				this.measure.destroy();
			}
		},
		deactivate: function () {
			this.isActive = false;
			this.clearContents();
			this.changeHeight();
		},
		changeHeight: function () {
			if (this.isActive) {
				domStyle.set("toolbarTop", "height", "110px");
			} else {
				domStyle.set("toolbarTop", "height", "41px");
			}
			registry.byId("toolbarTop").getParent().resize();
			topic.publish('viewer/repositionButtons', 'top');
		},
		setMapClickMode: function () {
			
		}
	});
});