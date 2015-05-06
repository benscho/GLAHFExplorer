define([
   'dojo/_base/declare',
   'dijit/_WidgetBase',
   'dijit/_TemplatedMixin',
   'dijit/_WidgetsInTemplateMixin',
   'dijit/Menu',
   'dijit/MenuItem',
   'dojo/_base/lang',
   'dojo/_base/Color',
   'esri/toolbars/draw',
   './esriGraphicsLayer',
   './TextGraphic',
   'esri/renderers/SimpleRenderer',
   'dojo/text!./Draw/templates/Draw.html',
   'esri/renderers/UniqueValueRenderer',
   'esri/symbols/SimpleMarkerSymbol',
   'esri/symbols/SimpleLineSymbol',
   'esri/symbols/SimpleFillSymbol',
   'esri/symbols/TextSymbol',
   'esri/symbols/Font',
   'esri/layers/FeatureLayer',
   'esri/geometry/Polygon',
   'esri/toolbars/edit',
   'dojo/topic',
   'dojo/aspect',
   'dojo/keys',
   'dojo/on',
   'dojo/i18n!./Draw/nls/resource',

   'dijit/form/Button',
   'xstyle/css!./Draw/css/Draw.css',
   'xstyle/css!./Draw/css/adw-icons.css'
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Menu, MenuItem, lang, Color,
		Draw, GraphicsLayer, Graphic, SimpleRenderer, drawTemplate, UniqueValueRenderer, SimpleMarkerSymbol,
		SimpleLineSymbol, SimpleFillSymbol, TextSymbol, Font, FeatureLayer, Polygon, Edit, topic, aspect,
		keys, on, i18n) {

    // main draw dijit
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: drawTemplate,
        i18n: i18n,
        drawToolbar: null,
        mapClickMode: null,
        postCreate: function () {
            this.inherited(arguments);
            this.drawToolbar = new Draw(this.map);
            this.drawToolbar.on('draw-end', lang.hitch(this, 'onDrawToolbarDrawEnd'));

            this.createGraphicLayers();

			//this.viewEdit = new ViewEdit();
			
            this.own(topic.subscribe('mapClickMode/currentSet', lang.hitch(this, 'setMapClickMode')));
            if (this.parentWidget && this.parentWidget.toggleable) {
                this.own(aspect.after(this.parentWidget, 'toggle', lang.hitch(this, function () {
                    this.onLayoutChange(this.parentWidget.open);
                })));
            }
        },
        createGraphicLayers: function () {
            this.pointSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 10, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 1), new Color([255, 0, 0, 1.0]));
            this.polylineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASH, new Color([255, 0, 0]), 1);
            this.polygonSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.0]));
            this.pointGraphics = new GraphicsLayer({
                id: 'drawGraphics_point',
                title: 'Draw Graphics'
            });
            this.pointRenderer = new SimpleRenderer(this.pointSymbol);
            this.pointRenderer.label = 'User drawn points';
            this.pointRenderer.description = 'User drawn points';
            this.pointGraphics.setRenderer(this.pointRenderer);
            this.map.addLayer(this.pointGraphics);
			
            this.polylineGraphics = new GraphicsLayer({
                id: 'drawGraphics_line',
                title: 'Draw Graphics'
            });
            this.polylineRenderer = new SimpleRenderer(this.polylineSymbol);
            this.polylineRenderer.label = 'User drawn lines';
            this.polylineRenderer.description = 'User drawn lines';
            this.polylineGraphics.setRenderer(this.polylineRenderer);
            this.map.addLayer(this.polylineGraphics);

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
                id: 'drawGraphics_poly',
                title: 'Draw Graphics',
                mode: FeatureLayer.MODE_SNAPSHOT
            });
            this.polygonRenderer = new UniqueValueRenderer(new SimpleFillSymbol(), 'ren', null, null, ', ');
                this.polygonRenderer.addValue({
                    value: 1,
                    symbol: new SimpleFillSymbol({
                    color: [255,170,0,255],
                    outline: {
                        color: [255,170,0,255],
                        width: 1,
                        type: 'esriSLS',
                        style: 'esriSLSSolid'
                    },
                    type: 'esriSFS',
                    style: 'esriSFSForwardDiagonal'
                }),
                label: 'User drawn polygons',
                description: 'User drawn polygons'
            });
            this.polygonGraphics.setRenderer(this.polygonRenderer);
            this.map.addLayer(this.polygonGraphics);
			topic.subscribe('load/draw', lang.hitch(this, this.loadDrawnGraphics));
			topic.subscribe('load/clear', lang.hitch(this, this.clearGraphics));
			this.editToolbar = new Edit(this.map);
			this.map.on("click", lang.hitch(this, function (evt) {
				console.log("deactivating toolbar");
				this.editToolbar.deactivate();
			}));
			this.pointGraphics.on("click", lang.hitch(this, function (evt) {
				console.log("clicked on a point graphic");
				this.editGraphic(evt);
			}));
        },
        drawPoint: function () {
            this.disconnectMapClick();
            this.drawToolbar.activate(Draw.POINT);
            this.drawModeTextNode.innerText = this.i18n.labels.point;
        },
        drawCircle: function () {
            this.disconnectMapClick();
            this.drawToolbar.activate(Draw.CIRCLE);
            this.drawModeTextNode.innerText = this.i18n.labels.circle;
        },
        drawLine: function () {
            this.disconnectMapClick();
            this.drawToolbar.activate(Draw.POLYLINE);
            this.drawModeTextNode.innerText = this.i18n.labels.polyline;
        },
        drawFreehandLine: function () {
            this.disconnectMapClick();
            this.drawToolbar.activate(Draw.FREEHAND_POLYLINE);
            this.drawModeTextNode.innerText = this.i18n.labels.freehandPolyline;
        },
        drawPolygon: function () {
            this.disconnectMapClick();
            this.drawToolbar.activate(Draw.POLYGON);
            this.drawModeTextNode.innerText = this.i18n.labels.polygon;
        },
        drawFreehandPolygon: function () {
            this.disconnectMapClick();
            this.drawToolbar.activate(Draw.FREEHAND_POLYGON);
            this.drawModeTextNode.innerText = this.i18n.labels.freehandPolygon;
        },
		editGraphic: function (event) {
			
		},
        disconnectMapClick: function () {
            topic.publish('mapClickMode/setCurrent', 'draw');
            this.enableStopButtons();
            // dojo.disconnect(this.mapClickEventHandle);
            // this.mapClickEventHandle = null;
        },
        connectMapClick: function () {
            topic.publish('mapClickMode/setDefault');
            this.disableStopButtons();
            // if (this.mapClickEventHandle === null) {
            //     this.mapClickEventHandle = dojo.connect(this.map, 'onClick', this.mapClickEventListener);
            // }
        },
        onDrawToolbarDrawEnd: function (evt) {
			this.drawToolbar.deactivate();
            this.drawModeTextNode.innerText = this.i18n.labels.currentDrawModeNone;
            var graphic;
			var textSymbol = new TextSymbol("Test text");
            switch (evt.geometry.type) {
                case 'point':
                    graphic = new Graphic(evt.geometry);
					//graphic.setTextSymbol(textSymbol);
					//this.pointGraphics.addTextGraphic(graphic);
					this.pointGraphics.add(graphic);
                    break;
                case 'polyline':
                    graphic = new Graphic(evt.geometry);
                    this.polylineGraphics.add(graphic);
                    break;
                case 'polygon':
                    graphic = new Graphic(evt.geometry, null, {
                        ren: 1
                    });
                    this.polygonGraphics.add(graphic);
                    break;
                default:
            }
			var textGraphic = new Graphic(evt.geometry);
			textGraphic.setSymbol(textSymbol);
			this.pointGraphics.add(textGraphic);
			this.editToolbar.activate(31, textGraphic);
        },
        clearGraphics: function () {
            this.endDrawing();
            this.connectMapClick();
            this.drawModeTextNode.innerText = 'None';
        },
        stopDrawing: function () {
            this.drawToolbar.deactivate();
            this.drawModeTextNode.innerText = 'None';
            this.connectMapClick();
        },
        endDrawing: function () {
            this.pointGraphics.clear();
            this.polylineGraphics.clear();
            this.polygonGraphics.clear();
            this.drawToolbar.deactivate();
            this.disableStopButtons();
        },
        disableStopButtons: function () {
            this.stopDrawingButton.set( 'disabled', true );
            this.eraseDrawingButton.set( 'disabled', !this.noGraphics() );
        },
        enableStopButtons: function () {
            this.stopDrawingButton.set( 'disabled', false );
            this.eraseDrawingButton.set( 'disabled', !this.noGraphics() );
        },
        noGraphics: function () {

            if ( this.pointGraphics.graphics.length > 0 ) {
                return true;
            } else if ( this.polylineGraphics.graphics.length > 0 ) {
                return true;
            } else if ( this.polygonGraphics.graphics.length > 0 ) {
                return true;
            } else {
                return false;
            }
            return false;

        },
        onLayoutChange: function (open) {
            // end drawing on close of title pane
            if (!open) {
                //this.endDrawing();
                if (this.mapClickMode === 'draw') {
                    //topic.publish('mapClickMode/setDefault');
                }
            }
        },
        setMapClickMode: function (mode) {
            this.mapClickMode = mode;
        },
		loadDrawnGraphics: function (data) {
			var parts = data.id.split("_"), graphic;
			switch (parts[1]) {
			case 'point':
				graphic = new Graphic(new esri.geometry.Point(data.geometry));
				if (data.symbol) {
					graphic.setSymbol(new TextSymbol(data.symbol));
				}
				this.pointGraphics.add(graphic);
				break;
			case 'polyline':
				graphic = new Graphic(data.geometry);
				this.polylineGraphics.add(graphic);
				break;
			case 'poly':
				graphic = new Graphic(new Polygon(data.geometry), null, {
					ren: 1
				});
				this.polygonGraphics.add(graphic);
				break;
			default:
			}
		}
    });
});