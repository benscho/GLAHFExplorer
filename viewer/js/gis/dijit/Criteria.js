define([
	'esri/tasks/QueryTask',
	'esri/tasks/query',
	'esri/geometry/geometryEngine',
	'esri/layers/FeatureLayer',
	'esri/renderers/UniqueValueRenderer',
	'esri/symbols/SimpleFillSymbol',
	'esri/graphic',
	'esri/geometry/Polygon',
	'esri/Color',
	'esri/SpatialReference',
	'esri/units',
	'esri/tasks/Geoprocessor',
	'esri/tasks/GeometryService',

	'dstore/Memory',
	
	'dojo/dom-style',
	'dojo/on',
	'dojo/dom',
	'dojo/request',
	'dojo/_base/declare',
	'dojo/_base/lang',
	'dojo/promise/all',
	'dojo/topic',
	'dojo/io-query',
	
	'dgrid/Grid',
	
	'dijit/layout/ContentPane',
	'dijit/registry',
	'dijit/form/Form',
	'dijit/form/RadioButton',
	'dijit/form/ComboBox',
	'dijit/form/TextBox',
	'dijit/form/Button',
	'dijit/form/CheckBox',
	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
	'dijit/_WidgetsInTemplateMixin',
	'dojo/text!./Criteria/templates/Criteria.html',
	'xstyle/css!./Criteria/css/Criteria.css'
], function (QueryTask, Query, GeometryEngine, FeatureLayer, UniqueValueRenderer, SimpleFillSymbol,
			Graphic, Polygon, Color, SpatialReference, Units, Geoprocessor, GeometryService, Memory,
			domStyle, on, dom, request, declare, lang, all, topic, ioQuery, Grid, ContentPane, registry, Form,
			RadioButton, ComboBox, TextBox, Button, CheckBox, _WidgetBase, _TemplatedMixin,
				_WidgetsInTemplateMixin, criteriaTemplate) {
	
	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		referenceLayers: [],
		queryID: 0,
		widgetsInTemplate: true,
		templateString: criteriaTemplate,
		postCreate: function () {
			this.inherited(arguments);
			this.initCriteria();
		},
		initCriteria: function () {
			this.polygonGraphics = new FeatureLayer({
				layerDefinition: {
					geometryType: 'esriGeometryPolygon',
					fields: [{
						name: 'OBJECTID',
						type: 'esriFieldTypeOID',
						alias: 'OBJECTID',
						domain: null,
						editable: false,
						nullable: false
					}, {
						name: 'ren',
						type: 'esriFieldTypeInteger',
						alias: 'ren',
						domain: null,
						editable: true,
						nullable: false
					}]
				},
				featureSet: null
			}, {
				id: 'criteria_poly',
				title: 'Criteria Graphics',
				mode: FeatureLayer.MODE_SNAPSHOT
			});
			this.polygonRenderer = new UniqueValueRenderer(new SimpleFillSymbol(), 'ren', null, null, ', ');
			this.polygonRenderer.addValue({
				value: 1,
				symbol: new SimpleFillSymbol({
					color: new Color("99FF33"),
					outline: {
						color: new Color("99FF33"),
						width: 1,
						type: 'esriSLS',
						style: 'esriSLSSolid'
					},
					type: 'esriSFS',
					style: 'esriSFSSolid'
				}),
				label: 'Polygons that meet criteria',
				description: 'Polygons that meet criteria'
            });
            this.polygonGraphics.setRenderer(this.polygonRenderer);
            this.map.addLayer(this.polygonGraphics);
			this.criteriaObjs = [];
			request.get("js/gis/dijit/Criteria/json/criteria.json", {
				handleAs: "json"
			}).then(function (results) {
				for(var i in results) {
					if (results[i].type === "select") {
						var myStore = new Memory({
							data: [
								{name:"Options...", id:"option"}
							]
						});
						dom.byId('criteriaOptions').innerHTML += results[i].name + ":";
						var combo = new ComboBox({
							name: results[i].name,
							id: "criteria-"+i,
							value: "Options...",
							URL: results[i].URL,
							layer: results[i].layer,
							param: results[i].param,
							store: myStore
						}).placeAt('criteriaOptions');
						combo.startup();
						dom.byId('criteriaOptions').innerHTML += "<br>";
					} else if (results[i].type === "text") {
						dom.byId('criteriaOptions').innerHTML += results[i].name + ":";
						var textbox = new TextBox({
							name: results[i].name,
							id: "criteria-"+i,
							URL: results[i].URL,
							layer: results[i].layer,
							param: results[i].param
						}).placeAt('criteriaOptions');
						textbox.startup();
						dom.byId('criteriaOptions').innerHTML += "<br>";
					} else if (results[i].type === "radio") {
						dom.byId('criteriaOptions').innerHTML +="<u>"+ results[i].name + "</u>:&nbsp;<i class=\"fa fa-info fa-2\" title=\"" + results[i].description + "\"></i>" 
							+ "<br><div data-dojo-type=\"dijit/form/Form\" id=\"criteria-" + i + "\" name=\"" + results[i].name + "\" URL=\"" + results[i].URL + "\" param=\"" + results[i].param
							+ "\" layer=\"" + results[i].layer + "\"></div>";
						for(var j in results[i].choices){
							dom.byId("criteria-" + i).innerHTML += "<input type=\"radio\" name=\"" 
							+ results[i].name + "\" value=\"" + results[i].choices[j][1] + "\"></input>" + results[i].choices[j][0];
						}
					} else if (results[i].type === "heading") {
						dom.byId('criteriaOptions').innerHTML += "<h4 id=\"criteria-"+ i + "\" name=\"header\">" + results[i].name + "</h4>";
					} else { //result.type not recognized
						console.log("ERROR: Unrecognized results[i].type: " + results[i]);
					}
				}
			}); 
			this.geoInfo = new Memory({ idProperty: 'id', data: []});
			topic.subscribe("load/criteria", lang.hitch(this, this.loadCriteria));
		},
		runInvestigation: function (polygonGraphics) {
			var i = 0, result, criteriaDeferreds = [], criteriaURLs = "";
			var selected = document.querySelectorAll("div#criteriaOptions input[type=radio]:checked");
			if (selected.length === 0) {
				alert("Please select one or more of the habitat criteria before hitting the Investigate button!");
				return;
			}
			for (var i in selected) {
				if (i === "length") {
					break;
				}
				var parent = selected[i].parentNode;
				curVal = selected[i].value;
				curParam = parent.attributes.param.value;
				curURL = parent.attributes.url.value;
				curLayer = parent.attributes.layer.value;
				var query = {
					where: curParam + "=" + curVal,
					f: "json"
				};
				var queryStr = curURL + "/" + curLayer + "/query?" + ioQuery.objectToQuery(query);
				var url = curURL + "/" + curLayer + "/query?where=" + curParam + "=" + curVal + "&f=json";
				criteriaURLs += queryStr + ",";
			}
			criteriaURLs = criteriaURLs.slice(0, -1); //trim last ,
			var drawnGeo = {};
			var params = {
				"Layers": criteriaURLs
			};
			if(registry.byId("criteriaCheck").checked) {
				drawnGeo = this.polygonGraphics.graphics;
				params.Geometry = new Polygon(drawnGeo);
				this.polygonGraphics.clear();
			}
			console.log(params);
			gp = new Geoprocessor("https://arcgisdev.lsa.umich.edu/arcgis/rest/services/IFR/Criteria/GPServer/Criteria");
			gp.submitJob(params, lang.hitch(this, this.criteriaComplete), this.criteriaStatus, this.criteriaFailed);
			domStyle.set(dojo.byId("criteriaSpinner"), "display", "inline");
		},
		criteriaComplete: function (jobInfo) {
			console.log("succeeded!");
			gp = new Geoprocessor("https://arcgisdev.lsa.umich.edu/arcgis/rest/services/IFR/Criteria/GPServer/Criteria");
			gp.getResultData(jobInfo.jobId, "outputFC", lang.hitch(this, function (results) {
				console.log("retrived results");
				for(var i in results.value.features) {
					var graphic = new Graphic(results.value.features[i].geometry, null, { ren: 1 });
					this.polygonGraphics.add(graphic);
				}
				domStyle.set(dojo.byId("criteriaSpinner"), "display", "none");
			}), function (error) {
				console.log("failure to return results");
			});
		},
		criteriaStatus: function (info) {
			console.log("status: " + info);
		},
		criteriaFailed: function (error) {
			console.log("failed: " + error);
		},
		clearCriteria: function () {
			this.polygonGraphics.clear();
			var checkedNodes = document.querySelectorAll("div#criteriaOptions input[type=radio]:checked");
			for(var i in checkedNodes) {
				checkedNodes[i].checked = false;
			}
		},
		loadCriteria: function (data) {
			this.clearCriteria();
			var graphic = new Graphic(new Polygon(data.geometry), null, { ren: 1 });
			this.polygonGraphics.add(graphic);
		},
		/*createFeatureTable: function (polygons) {
            //var attributeTable = registry.byId('attributesContainer_widget');
			var tabContainer = registry.byId('tabContainer');
            this.queryID = this.queryID + 1;
			var columns = [ //start simple, add lake, subbasin, zone after we get it working
				{
					field: "number",
					label: "#"
				},
				{
					field: "area",
					label: "Area (km^2)"
				}
			];
			
			var processedResults = [];
			for(var i=0;i<polygons.rings.length;i++) {
				var result = [];
				result.number = i+1;
				result.polygon = new Polygon(new SpatialReference(102100));
				result.polygon.addRing(polygons.rings[i]);
				result.area = GeometryEngine.geodesicArea(result.polygon);
				processedResults[i] = result;
			}
			
			var grid = new Grid({
				id: this.queryID,
				columns: columns
			});
			grid.renderArray(processedResults);
			var cp = new ContentPane({
				title: "Criteria " + this.queryID,
				content: grid
			});
			tabContainer.addChild(cp);
		}*/
	});
});