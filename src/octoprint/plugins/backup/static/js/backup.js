(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(["OctoPrintClient"], factory);
    } else {
        factory(global.OctoPrintClient);
    }
})(this, function(OctoPrintClient) {
    var OctoPrintBackupClient = function(base) {
        this.base = base;
        this.url = this.base.getBlueprintUrl("backup");
    };

    OctoPrintBackupClient.prototype.get = function(refresh, opts) {
        return this.base.get(this.url + "backup", opts);
    };

    OctoPrintBackupClient.prototype.getWithRefresh = function(opts) {
        return this.get(true, opts);
    };

    OctoPrintBackupClient.prototype.getWithoutRefresh = function(opts) {
        return this.get(false, opts);
    };

    OctoPrintBackupClient.prototype.createBackup = function(exclude, opts) {
        exclude = exclude || [];

        var data = {
            exclude: exclude
        };

        return this.base.postJson(this.url + "backup", data, opts);
    };

    OctoPrintBackupClient.prototype.deleteBackup = function(backup, opts) {
        return this.base.delete(this.url + "backup/" + backup, opts);
    };

    OctoPrintBackupClient.prototype.restoreBackup = function(backup, opts) {
        var data = {
            path: backup
        };

        return this.base.postJson(this.url + "restore", data, opts);
    };

    OctoPrintBackupClient.prototype.restoreBackupFromUpload = function (file, data) {
        data = data || {};

        var filename = data.filename || undefined;
        return this.base.upload(this.url + "restore", file, filename, data);
    };

    OctoPrintClient.registerPluginComponent("backup", OctoPrintBackupClient);
    return OctoPrintBackupClient;
});

$(function() {
    function BackupViewModel(parameters) {
        var self = this;

        self.loginState = parameters[0];
        self.settings = parameters[1];

        self.backups = new ItemListHelper(
            "plugin.backup.backups",
            {
                "date": function (a, b) {
                    // sorts descending
                    if (a["date"] > b["date"]) return -1;
                    if (a["date"] < b["date"]) return 1;
                    return 0;
                }
            },
            {
            },
            "date",
            [],
            [],
            10
        );

        self.markedForBackupDeletion = ko.observableArray([]);

        self.excludeFromBackup = ko.observableArray([]);
        self.backupInProgress = ko.observable(false);

        self.backupUploadButton = $("#settings-backup-upload");
        self.backupUploadData = undefined;
        self.backupUploadButton.fileupload({
            dataType: "json",
            maxNumberOfFiles: 1,
            autoUpload: false,
            headers: OctoPrint.getRequestHeaders(),
            add: function(e, data) {
                if (data.files.length === 0) {
                    // no files? ignore
                    return false;
                }

                self.backupUploadName(data.files[0].name);
                self.backupUploadData = data;
            },
            done: function(e, data) {
                self.backupUploadName(undefined);
                self.backupUploadData = undefined;
            }
        });
        self.backupUploadName = ko.observable();
        self.restoreInProgress = ko.observable(false);
        self.restoreTitle = ko.observable();
        self.restoreDialog = undefined;
        self.restoreOutput = undefined;

        self.loglines = ko.observableArray([]);

        self.requestData = function() {
            OctoPrint.plugins.backup.get()
                .done(self.fromResponse);
        };

        self.fromResponse = function(response) {
            self.backups.updateItems(response.backups);
        };

        self.createBackup = function() {
            var excluded = self.excludeFromBackup();
            OctoPrint.plugins.backup.createBackup(excluded)
                .done(function() {
                    self.excludeFromBackup([]);
                })
        };

        self.removeBackup = function(backup) {
            OctoPrint.plugins.backup.deleteBackup(backup)
                .done(function() {
                    self.requestData();
                })
        };

        self.restoreBackup = function(backup) {
            OctoPrint.plugins.backup.restoreBackup(backup)
                .done(function() {
                    // do something
                })
        };

        self.performRestoreFromUpload = function() {
            if (self.backupUploadData === undefined) return;
            self.backupUploadData.submit();
        };

        self.markFilesOnPage = function() {
            self.markedForBackupDeletion(_.uniq(self.markedForBackupDeletion().concat(_.map(self.backups.paginatedItems(), "name"))));
        };

        self.markAllFiles = function() {
            self.markedForBackupDeletion(_.map(self.backups.allItems, "name"));
        };

        self.clearMarkedFiles = function() {
            self.markedForBackupDeletion.removeAll();
        };

        self.removeMarkedFiles = function() {
            var perform = function() {
                self._bulkRemove(self.markedForBackupDeletion())
                    .done(function() {
                        self.markedForBackupDeletion.removeAll();
                    });
            };

            showConfirmationDialog(_.sprintf(gettext("You are about to delete %(count)d backups."), {count: self.markedForBackupDeletion().length}),
                                   perform);
        };

        self.onStartup = function() {
            self.restoreDialog = $("#settings_plugin_backup_restoredialog");
            self.restoreOutput = $("#settings_plugin_backup_restoredialog_output");
        };

        self.onSettingsShown = function() {
            self.requestData();
        };

        self.onDataUpdaterPluginMessage = function(plugin, data) {
            if (plugin !== "backup") return;

            if (data.type === "backup_done") {
                self.requestData();
                self.backupInProgress(false);
            } else if (data.type === "backup_started") {
                self.backupInProgress(true);
            } else if (data.type === "restore_started") {
                self.restoreInProgress(true);
                self.loglines.removeAll();
                self.loglines.push({line: gettext("Restoring from backup..."), stream: "message"});
                self.loglines.push({line: " ", stream: "message"});
                self.restoreDialog.modal({keyboard: false, backdrop: "static", show: true});
            } else if (data.type === "restore_failed") {
                self.loglines.push({line: " ", stream: "message"});
                self.loglines.push({line: gettext("Restore failed! Check the above output and octoprint.log for reasons as to why."), stream: "error"});
                self.restoreInProgress(false);
            } else if (data.type === "restore_done") {
                self.loglines.push({line: " ", stream: "message"});
                self.loglines.push({line: gettext("Restore successful! The server will now be restarted!"), stream: "message"});
                self.restoreInProgress(false);
            } else if (data.type === "install_plugin") {
                self.loglines.push({line: " ", stream: "message"});
                self.loglines.push({line: _.sprintf(gettext("Installing plugin \"%(plugin)s}\"..."), {plugin: data.plugin.name}), stream: "message"});
            } else if (data.type === "unknown_plugins") {
                if (data.plugins.length > 0) {
                    self.loglines.push({line: " ", stream: "message"});
                    self.loglines.push({line: _.sprintf(gettext("There are %(count)d plugins you'll need to install manually since they aren't registered on the repository:"), {count: data.plugins.length}), stream: "message"});
                    _.each(data.plugins, function(plugin) {
                        self.loglines.push({line: plugin.name + ": <a href=\"" + plugin.url + "\" target=\"_blank\">" + plugin.url + "</a>", stream: "message"});
                    });
                    self.loglines.push({line: " ", stream: "message"});
                }
            } else if (data.type === "logline") {
                self.loglines.push(self._preprocessLine({line: data.line, stream: data.stream}));
                self._scrollRestoreOutputToEnd();
            }
        };

        self._scrollRestoreOutputToEnd = function() {
            self.restoreOutput.scrollTop(self.restoreOutput[0].scrollHeight - self.restoreOutput.height());
        };

        self._forcedStdoutLine = /You are using pip version .*?, however version .*? is available\.|You should consider upgrading via the '.*?' command\./;
        self._preprocessLine = function(line) {
            if (line.stream === "stderr" && line.line.match(self._forcedStdoutLine)) {
                line.stream = "stdout";
            }
            return line;
        };

        self._bulkRemove = function(files) {
            var title, message, handler;

            title = gettext("Deleting backups");
            message = _.sprintf(gettext("Deleting %(count)d backups..."), {count: files.length});
            handler = function(filename) {
                return OctoPrint.plugins.backup.deleteBackup(filename)
                    .done(function() {
                        deferred.notify(_.sprintf(gettext("Deleted %(filename)s..."), {filename: filename}), true);
                    })
                    .fail(function(jqXHR) {
                        var short = _.sprintf(gettext("Deletion of %(filename)s failed, continuing..."), {filename: filename});
                        var long = _.sprintf(gettext("Deletion of %(filename)s failed: %(error)s"), {filename: filename, error: jqXHR.responseText});
                        deferred.notify(short, long, false);
                    });
            };

            var deferred = $.Deferred();

            var promise = deferred.promise();

            var options = {
                title: title,
                message: message,
                max: files.length,
                output: true
            };
            showProgressModal(options, promise);

            var requests = [];
            _.each(files, function(filename) {
                var request = handler(filename);
                requests.push(request)
            });
            $.when.apply($, _.map(requests, wrapPromiseWithAlways))
                .done(function() {
                    deferred.resolve();
                    self.requestData();
                });

            return promise;
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: BackupViewModel,
        dependencies: ["loginStateViewModel", "settingsViewModel"],
        elements: ["#settings_plugin_backup"]
    });
});
