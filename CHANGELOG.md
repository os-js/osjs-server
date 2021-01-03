# Changelog for osjs-server

## 3.1.17 - 2021-01-03

* Send entire session object in login/out signal (#47)

## 3.1.16 - 2021-01-01

* Don't allow client to use internal signals

## 3.1.15 - 2021-01-01

* Added signals for user login/logout (#45) (#46)

## 3.1.14 - 2020-11-26

No changes. Forgot to pull with rebase before publish.

## 3.1.13 - 2020-11-26

* Updated dependencies

## 3.1.12 - 2020-08-22

* Updated esdoc setup

## 3.1.11 - 2020-08-20

* Updated documentation
* Updated esdoc configs
* Updated dependencies
* Added 'websocket' to express service contract

## 3.1.10 - 2020-07-28

* Try to create home directory on login (#37) (#38)

## 3.1.9 - 2020-07-23

* Add appropriate error message on missing vfs adapter methods
* Fixed search in readonly mountpoints (fixes #36)

## 3.1.8 - 2020-07-22

* Minor cleanups

## 3.1.7 - 2020-07-22

* Abstracted away req/res from VFS calls in favor of options (#34)
* Support async adapter functions (#34)

## 3.1.6 - 2020-07-17

* Send content-type mime on readfile if available (#35)

## 3.1.5 - 2020-06-27

* Moved ranged VFS responses down to API (from adapter)

## 3.1.4 - 2020-06-24

* VFS readfile downloads no longer relies on physical paths (fixes #33)

## 3.1.3 - 2020-06-11

* Added some error logging to VFS
* Updated Core#destroy async expressions

## 3.1.2 - 2020-04-12

* Require node 10 or later
* Made Core destroy procedure async

## 3.1.1 - 2020-04-11

* Added websocket client ping (#30)

## 3.1.0 - 2020-04-10

* Added support for https (#26) (#27)
* Added timestamps to CHANGELOG.md

## 3.0.55 - 2020-02-16

* Updated dependencies

## 3.0.54 - 2020-02-14

* Removed process.exit from Core

## 3.0.53 - 2020-01-21

* Updated exports

## 3.0.52 - 2020-01-19

* Updated dependencies

## 3.0.51 - 2020-01-19

* Updated dependencies
* Updated dotfile usage
* Updated copyright notices in preambles

## 3.0.50 - 2020-01-15

* Eslint pass
* Updated dotfiles
* Updated dependencies

## 3.0.49 - 2019-11-21

* Added strict check argument to routeAuthenticated

## 3.0.48 - 2019-11-21

* Add a default group set in realpath (#21)

## 3.0.47 - 2019-11-21

* Added abitlity to make VFS group checking non-strict (#22) (#23)

## 3.0.46 - 2019-10-18

* Fix issue with path resolution in VFS on cross requests (fixes #19)

## 3.0.45 - 2019-10-18

* Correctly detect VFS options on GET (fixes #18)

## 3.0.44 - 2019-06-11

* Support more characters in vfs mountpoint names

## 3.0.43 - 2019-06-02

* Added ranged HTTP response support in system adapter (fixes #15) (#16)

## 3.0.42 - 2019-05-24

* Supress warnings from invalid websocket messages

## 3.0.41 - 2019-04-13

* Updated dependencies

## 3.0.40 - 2019-04-13

* Added Filesystem#call for abstracted calls

## 3.0.39 - 2019-04-12

* Added Auth#register and adapter support

## 3.0.38 - 2019-04-09

* Updated Filesystem#realpath signature

## 3.0.37 - 2019-04-08

* Updated dependencies

## 3.0.36 - 2019-03-27

* Add rolling session updates (fixes #6)

## 3.0.35 - 2019-03-26

* Added 'routeAuthenticated' group behavior option (closes #13)

## 3.0.34 - 2019-03-26

* Added denyUsers and requiredGroups to authenticator

## 3.0.33 - 2019-03-26

* Emit warning when files missing in dist (closes #11)
* Updated consola logging pause in tests
* Added some abstraction to system VFS adapter
* Updated auth.js comment header
* Updated esdoc

## 3.0.32 - 2019-03-24

* Send VFS watch trigger type in broadcast call
* Updated unit tests
* Updated chokidar dependency
* Updated system vfs adapter watcher
* Added 'osjs/fs' service
* Updated watch handling in Filesystem class
* Added missing return in VFS watch for system adapter
* Updated providers
* Updated logging
* Changed from 'signale' to 'consola' logger
* Minor cleanup in Core
* Refactored package loading procedure

## 3.0.30 - 2019-03-23

* Added files section to package.json

## 3.0.29 - 2019-03-23

* Added back killswitch to Core

## 3.0.28 - 2019-03-23

* Updated README
* Split out and cleaned up some core from CoreServiceProvider
* Some cleanups in src/utils/vfs.js
* Some cleanups for Package class integrations
* Minor cleanup in src/providers/core.js
* Minor cleanup in src/vfs.fs
* Fixed typo in package.json
* Added 'test' script to package.json
* Added unit tests
* Updated package.json scripts
* Split up some functions used in Core
* Updated gitignore
* Updated eslintrc
* Updated some checks and returns in Core#boot process
* Added JSON parse check in argv override for Core options
* Fixed spelling error in Core#destroy check
* Added wss property to Core
* Moved some developer stuff from Core to provider
* Minor fixes in Filesystem class
* Run 'httpServer.close()' on Core#destroy
* Updated Settings init
* Make Settings#init return result from adapter
* Minor cleanup in Auth class
* Updated default adapters
* Properly close watches on Core#destroy
* Don't use process.exit in Core

## 3.0.27

* Hotfix for some VFS methods

## 3.0.26 - 2019-03-19

* Added 'osjs/core:ping' event
* Refactored VFS implementation
* Cleaned up some methods in Filesystem class
* Simplified some VFS method abstraction
* Refactored VFS methods interface signatures
* Split up adapters from Settings class
* Split up package loading from Packages class
* Moved some VFS files
* Cleaned up core provider init
* Split out Auth from AuthProvider

## 3.0.25 - 2019-02-25

* Fixed 'fs' Settings adapter (fixes #14)

## 3.0.24 - 2019-02-19

* Added Core.getInstance

## 3.0.23 - 2019-02-05

* Added 'realpath' method to VFS (for internal usage)

## 3.0.22 - 2019-02-02

* Updated routeAuthenticated group gating (#13)

## 3.0.21 - 2019-01-26

* Update websocket message handling

## 3.0.20 - 2019-01-26

* Addded 'call' method to expres service
* Added support for injecting middleware for routes

## 3.0.19 - 2019-01-19

* Updated dependencies
* Update config.js (#10)
* Updated README

## 3.0.18 - 2019-01-04

* Updated internal socket message handling

## 3.0.17 - 2019-01-04

* Fixed issue with non-client socket messaging

## 3.0.16 - 2019-01-01

* Added direct support for core websocket in applications
* Emit even on destruction

## 3.0.15 - 2018-12-29

* Additional ws broadcast methods (#4)
* Force session touch on ping (#6)

## 3.0.14 - 2018-12-23

* Added configurable default auth groups

## 3.0.13 - 2018-12-22

* Handle HEAD requests properly in VFS calls
* Make sure route helpers cast method to lowercase<Paste>

## 3.0.12 - 2018-12-16

* Updated MIME definitions

## 3.0.11 - 2018-12-09

* Added configurable VFS root directory

## 3.0.9 - 2018-12-04

* Updated filehound dependency (fixes #3)

## 3.0.8 - 2018-12-01

* Make sure 'attributes' is set in a mountpoint

## 3.0.7 - 2018-12-01

* Added a workaround from filehound blowing up
* Added 'searchable' vfs mountpoint attribute<Paste>

## 3.0.6 - 2018-11-25

* Added 'engines' to package.json

## 3.0.5 - 2018-11-25

* Updated dependencies
* Updated mime support

## 3.0.4 - 2018-11-24

* Added configuration of form/file post size limits

## 3.0.3 - 2018-11-19

* Added configurable 'manifest' file
* Added configurable 'discovery' file usage
* Removed unused Packages#constructor argument

## 3.0.2 - 2018-11-10

* Added support for custom mime resolution in VFS

## 3.0.1 - 2018-10-28

* Updated @osjs/common

## 3.0.0-alpha.42 - 2018-10-26

* Better VFS service exposure

## 3.0.0-alpha.41 - 2018-09-29

* Updated @osjs/common

## 3.0.0-alpha.40 - 2018-09-27

* Updated dependencies

## 3.0.0-alpha.39 - 2018-08-14

* Added 'nocache' package in development mode
* Added 'ensure' to mkdir VFS method options
* Updated some VFS method HTTP methods
* Ensure JSON vfs posts are not going through formidable
* Added 'touch' VFS endpoint

## 3.0.0-alpha.38 - 2018-08-11

* Added updated 'fs' settings adapter
* Add proper VFS exposure in provider
* Add some extra adapter error handling and fallback

## 3.0.0-alpha.37 - 2018-08-04

* Broadcast dist file changes in dev mode

## 3.0.0-alpha.36 - 2018-07-25

* Fixed some syntax errors
* Fixed eslint comment warnings

## 3.0.0-alpha.35 - 2018-07-24

* Split up Settings provider
* Split up Package Provider
* Split up VFS Provider / Filesystem
* Detach some VFS mountpoint properties
* Misc cleanups after VFS changes
* Support for operations between different adapters
* Cleaned up VFS request binding etc.
* Match VFS parameters from client in adapter methods

## 3.0.0-alpha.34 - 2018-07-21

* Fixed package reload (dev mode)

## 3.0.0-alpha.33 - 2018-07-21

* Add extra filtering in package script loading

## 3.0.0-alpha.32 - 2018-07-20

* Fixed removal of directories in system VFS adapter
* VFS search improvements
* Updated eslintrc

## 3.0.0-alpha.31 - 2018-07-19

* Updated @osjs/common dependency

## 3.0.0-alpha.30 - 2018-07-18

* Added VFS search() method
* Updated travis-ci
* Added travis-ci badge to README
* Added initial travis-ci config
* Better package loading on boot

## 3.0.0-alpha.29 - 2018-07-16

* Added 'download' for 'readfile' in system vfs

## 3.0.0-alpha.28 - 2018-07-14

* Allow override certain configurations via argv

## 3.0.0-alpha.27 - 2018-07-14

* Updated @osjs/common dependency
* Updated default configuration
* Use 'connect-loki' instead of 'session-file-store' (#2)

## 3.0.0-alpha.26 - 2018-07-10

* Updated dependencies
* Remove 'extended' usage in body-parser
* Added 'vfs.watch' config option
* Updated logging
* Added vfs change/watch events broadcasting over WS
* Added read-only support for mountpoints

## 3.0.0-alpha.25 - 2018-07-06

* Added 'ping' endpoint + cookie maxAge
* Added missing .eslintrc, cleanup

## 3.0.0-alpha.24 - 2018-06-21

* Added group-based permissions to VFS
* Force-save session on login

## 3.0.0-alpha.23 - 2018-06-17

* Provide 'fs' settings adapter

## 3.0.0-alpha.22 - 2018-06-09

* Added group checking to authenticated routes
* Add 'httpServer' reference in core

## 3.0.0-alpha.21 - 2018-05-23

* Emit starting events (#1)
* Added urlencoded body-parser middleware (#1)

## 3.0.0-alpha.20 - 2018-05-22

* Added proxy support via configuration

## 3.0.0-alpha.19 - 2018-05-10

* Solved an issue with readdir on Windows

## 3.0.0-alpha.18 - 2018-05-10

* Remove 'registerDefault' from Core options

This requires the distribution to manually register base providers.
See 'index.js' in the base repository.

## 3.0.0-alpha.17 - 2018-05-06

* Added npmignore
* Added CHANGELOG

## 3.0.0-alpha.16 - 2018-05-05

* Broadcast package/meta updates in dev mode
* Solved an issue with session saving

## 3.0.0-alpha.15 - 2018-04-29

* Added session customization, file as default
* Added broadcasting (ws) support
* Cleaned up HTTP VFS API, better error handling
* Updated some vfs handling
* Handle moutpoints properly, cleanups

## 3.0.0-alpha.14 - 2018-04-29

* Updated application initialization
* Provide more user information on login
* Updated http session handling, require user id from login

## 3.0.0-alpha.13 - 2018-04-29

* A more functional approach for Auth + Settings

## 3.0.0-alpha.11 - 2018-04-27

* Updated provider loading
* Renamed server.js -> core.js
* Minor cleanup in VFS provider
* Create 'osjs/vfs' service
* Added basic Settings service provider, cleanups
* Pass on 'config' in Auth constructor
* Correct passing on args to Auth class
* Split default config + CoreBase update
* Now using '@osjs/common' module
* Added symbol to provider logging
* Updated default auth routes
* VFS now uses authenticated middleware
* Added 'osjs/express' provider
* Copy service provider instanciating from client
* Added provider options in registration
* Keep same Auth interface as in client
* Updated auth handler
* Removed a configuration option
* Added 'null' auth handler
* Added options argument in service provider
* Added support for passing on default provider options

## 3.0.0-alpha.10 - 2018-04-22

* Added default 'home' mountpoint
* Added session support to segment parsing in vfs
* Sanitize paths given to VFS
* Update VFS configuration layout
* Added mounting of system directories
* Added config() to core
* Optimize readdir() in vfs
* Temporarily strip prefixes from inbound VFS call paths

## 3.0.0-alpha.9 - 2018-04-15

* Added copy() VFS method
* Use 'fs-extra' instead of builtin 'fs'
* Clean up temporaries on upload in vfs
* Added multipart/upload to VFS req parsing, writefile() method
* Updated VFS methods and integration

## 3.0.0-alpha.8 - 2018-04-07

* Changed app public path to '/apps/'

## 3.0.0-alpha.7 - 2018-03-31

* Added engines dependendy to package.json
* Added esdoc config, updated docs
* Removed DefaultServiceProvider
* Pass on a 'proc' object instead of metadata in applications
* Added helpers to application init call

## 3.0.0-alpha.6 - 2018-03-25

* Provide error code in scandir fail
* Corrected URLs in package.json

## 3.0.0-alpha.5 - 2018-03-19

Initial public release
