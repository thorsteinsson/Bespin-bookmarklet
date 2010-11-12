
// Code modified by �gir �orsteinsson <aegir@thorsteinsson.is>
// http://github.com/thorsteinsson/bespin-bookmarklet/

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is
 * Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

(function() {
	/** --------------------------------------------------------------------
	 * Load Bespin only when it's not already on the page.
	 */
	if (typeof bespin == 'undefined') {
		/** Adjust the following variables as needed **/
		var base = 'https://bespin.mozillalabs.com/bookmarklet/';
		var proxyFile = 'proxy.html';
		var bespinBase = base + "bespin/";

		var head = document.getElementsByTagName('head')[0];
		var iFrame;

		/** Add the bespin_base link to the header **/
		var l =  document.createElement('link');
		l.setAttribute('id', 'bespin_base');
		l.setAttribute('href', bespinBase);
		head.appendChild(l);

		/** Add some basic Bespin CSS **/
		l =  document.createElement('style');
		l.innerHTML = '.bespin{border:1px solid gray;}';
		head.appendChild(l);

		/** --------------------------------------------------------------------
		 * BEGIN: Proxy handling code.
		 */
		var postProxyMsg = function(obj) {
			iFrame.contentWindow.postMessage(JSON.stringify(obj), '*');
		};

		/** --------------------------------------------------------------------
		 * Worker proxy implementation.
		 */
		var lastWorker = 0;
		var workerList = [];

		/** Fake Worker class **/
		var WorkerProxy = function(url) {
			this.id = lastWorker ++;
			postProxyMsg({
				id: this.id,
				task: 'newWorker',
				url: url
			});
			workerList[this.id] = this;
		};

		WorkerProxy.prototype.postMessage = function(msg) {
			postProxyMsg({
				id: this.id,
				task: 'postWorker',
				msg: msg
			});
		};

		WorkerProxy.prototype.terminate = function() {
			postProxyMsg({
				id: this.id,
				task: 'terminateWorker'
			});
			delete workerList[this.id];
		};

		/** --------------------------------------------------------------------
		 * XHR proxy implementation.
		 */
		var xhrList = [];
		var lastXhr = 0;
		var XhrProxy = function(method, url, async, beforeSendCallback, pr) {
			postProxyMsg({
				id: lastXhr,
				task: 'xhr',
				method: method,
				url: url
			});

			xhrList[lastXhr] = pr;
			lastXhr ++;
		};

		/** --------------------------------------------------------------------
		 * Handler for messages from the proxy.
		 */
		var messageHandler = function(e){
			var obj = JSON.parse(e.data);

			switch (obj.type) {
				case 'xhr':
					var pr = xhrList[obj.id];
					if (obj.success) {
						pr.resolve(obj.data);
					} else {
						pr.reject(new Error(obj.data));
					}

					delete xhrList[obj.id];

					break;

				case 'worker':
					var worker = workerList[obj.id];
					if (obj.success) {
						worker.onmessage.call(worker, {
							data: obj.msg
						});
					} else {
						worker.onerror.call(worker, JSON.parse(obj.msg));
					}

					break;
			}

		};
		window.addEventListener('message', messageHandler, false);

		/** --------------------------------------------------------------------
		 * Put the xhr and worker proxy on the Bespin object.
		 */
		bespin = {
			proxy: {
				xhr: XhrProxy,
				worker: WorkerProxy
			}
		};

		/** --------------------------------------------------------------------
		 * Create an iFrame that has the proxy file as source. After the proxy
		 * file is loaded, add a script tag with the BespinEmbedded.js file
		 * as source to the current page. This will start the Bespin boot process.
		 */
		iFrame = l =  document.createElement('iFrame');
		l.setAttribute('src', base + proxyFile);
		l.onload = function() {
			s = document.createElement('script');
			s.src = bespinBase + 'BespinEmbedded.js';
			head.appendChild(s);

			/** Called when Bespin has finished loading. **/
			window.onBespinLoad = function() {
				var $ = bespin.tiki.require("jquery").$,
					selectedText,
					current,
					button = $("img").css({
						display: 'none',
						position: 'absolute',
						margin: 0,
						padding:0,
						'z-index': 10
					}).attr('src', base + 'bespin-logo.png').appendTo('body');
				
				button.bind('click', function(evt) {
					if (selectedText) {
						button.hide();
						current = $('<div><textarea/><div>').css({
							display: 'block',
							position: 'absolute',
							left: 0,
							top: 0,
							width: '100%',
							height: '100%',
							overflow: 'hidden',
							'z-index': 11
						}).appendTo('body');
						var elem = current.find('textarea').css({display: 'block', width: '100%', height: $(window).height()}).val(selectedText)[0];
						bespin.useBespin(elem, {
							stealFocus: true,
							syntax: 'js'
						});
					}
				});

				var getSelectedText = function(){
				  if (window.getSelection) {
					return window.getSelection();
				  } else if (document.getSelection) {
					return document.getSelection();
				  } else if (document.selection) {
					return document.selection.createRange().text;
				  }
				  return '';
				}

				$(document).bind('mouseup', function (evt) {
					var string = getSelectedText() + '';
					if (string.length > 0) {
						// show button
						selectedText = string;
						button.css({top: evt.pageY + 'px', left: evt.pageX + 'px'}).fadeIn();
					} else {
						button.hide();
					}
				}).bind('keyup', function(e) {
					if (e.keyCode === 27) { // ESC
						current.remove();
					}
				});
			};
		};
		head.appendChild(l);
	}
})();
