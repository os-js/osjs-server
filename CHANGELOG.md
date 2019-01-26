## Changelog for osjs-server

## 3.0.20

* Addded 'call' method to expres service
* Added support for injecting middleware for routes

## 3.0.19

* Updated dependencies
* Update config.js (#10)
* Updated README

## 3.0.18

* Updated internal socket message handling

## 3.0.17

* Fixed issue with non-client socket messaging

## 3.0.16

* Added direct support for core websocket in applications
* Emit even on destruction

## 3.0.15

* Additional ws broadcast methods (#4)
* Force session touch on ping (#6)

## 3.0.14

* Added configurable default auth groups

## 3.0.13

* Handle HEAD requests properly in VFS calls
* Make sure route helpers cast method to lowercase<Paste>

## 3.0.12

* Updated MIME definitions

## 3.0.11

* Added configurable VFS root directory

## 3.0.9

* Updated filehound dependency (fixes #3)

## 3.0.8

* Make sure 'attributes' is set in a mountpoint

## 3.0.7

* Added a workaround from filehound blowing up
* Added 'searchable' vfs mountpoint attribute<Paste>

## 3.0.6

* Added 'engines' to package.json

## 3.0.5

* Updated dependencies
* Updated mime support

## 3.0.4

* Added configuration of form/file post size limits

## 3.0.3

* Added configurable 'manifest' file
* Added configurable 'discovery' file usage
* Removed unused Packages#constructor argument

## 3.0.2

* Added support for custom mime resolution in VFS

## 3.0.1

* Updated @osjs/common

## 3.0.0-alpha.42

* Better VFS service exposure

## 3.0.0-alpha.41

* Updated @osjs/common

## 3.0.0-alpha.40

* Updated dependencies

## 3.0.0-alpha.39

* Added 'nocache' package in development mode
* Added 'ensure' to mkdir VFS method options
* Updated some VFS method HTTP methods
* Ensure JSON vfs posts are not going through formidable
* Added 'touch' VFS endpoint

## 3.0.0-alpha.38

* Added updated 'fs' settings adapter
* Add proper VFS exposure in provider
* Add some extra adapter error handling and fallback

## 3.0.0-alpha.37

* Broadcast dist file changes in dev mode

## 3.0.0-alpha.36

* Fixed some syntax errors
* Fixed eslint comment warnings

## 3.0.0-alpha.35

* Split up Settings provider
* Split up Package Provider
* Split up VFS Provider / Filesystem
* Detach some VFS mountpoint properties
* Misc cleanups after VFS changes
* Support for operations between different adapters
* Cleaned up VFS request binding etc.
* Match VFS parameters from client in adapter methods

## 3.0.0-alpha.34

* Fixed package reload (dev mode)

## 3.0.0-alpha.33

* Add extra filtering in package script loading

## 3.0.0-alpha.32

* Fixed removal of directories in system VFS adapter
* VFS search improvements
* Updated eslintrc

## 3.0.0-alpha.31

* Updated @osjs/common dependency

## 3.0.0-alpha.30

* Added VFS search() method
* Updated travis-ci
* Added travis-ci badge to README
* Added initial travis-ci config
* Better package loading on boot

## 3.0.0-alpha.29

* Added 'download' for 'readfile' in system vfs

## 3.0.0-alpha.28

* Allow override certain configurations via argv

## 3.0.0-alpha.27

* Updated @osjs/common dependency
* Updated default configuration
* Use 'connect-loki' instead of 'session-file-store' (#2)

## 3.0.0-alpha.26

* Updated dependencies
* Remove 'extended' usage in body-parser
* Added 'vfs.watch' config option
* Updated logging
* Added vfs change/watch events broadcasting over WS
* Added read-only support for mountpoints

## 3.0.0-alpha.25

* Added 'ping' endpoint + cookie maxAge
* Added missing .eslintrc, cleanup

## 3.0.0-alpha.24

* Added group-based permissions to VFS
* Force-save session on login

## 3.0.0-alpha.23

* Provide 'fs' settings adapter

## 3.0.0-alpha.22

* Added group checking to authenticated routes
* Add 'httpServer' reference in core

## 3.0.0-alpha.21

* Emit starting events (#1)
* Added urlencoded body-parser middleware (#1)

## 3.0.0-alpha.20

* Added proxy support via configuration

## 3.0.0-alpha.19

* Solved an issue with readdir on Windows

## 3.0.0-alpha.18

* Remove 'registerDefault' from Core options

This requires the distribution to manually register base providers.
See 'index.js' in the base repository.

## 3.0.0-alpha.17

* Added npmignore
* Added CHANGELOG

## 3.0.0-alpha.16

* Broadcast package/meta updates in dev mode
* Solved an issue with session saving

## 3.0.0-alpha.15

* Added session customization, file as default
* Added broadcasting (ws) support
* Cleaned up HTTP VFS API, better error handling
* Updated some vfs handling
* Handle moutpoints properly, cleanups

## 3.0.0-alpha.14

* Updated application initialization
* Provide more user information on login
* Updated http session handling, require user id from login

## 3.0.0-alpha.13

* A more functional approach for Auth + Settings

## 3.0.0-alpha.11

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

## 3.0.0-alpha.10

* Added default 'home' mountpoint
* Added session support to segment parsing in vfs
* Sanitize paths given to VFS
* Update VFS configuration layout
* Added mounting of system directories
* Added config() to core
* Optimize readdir() in vfs
* Temporarily strip prefixes from inbound VFS call paths

## v3.0.0-alpha.9

* Added copy() VFS method
* Use 'fs-extra' instead of builtin 'fs'
* Clean up temporaries on upload in vfs
* Added multipart/upload to VFS req parsing, writefile() method
* Updated VFS methods and integration

## v3.0.0-alpha.8

* Changed app public path to '/apps/'

## v3.0.0-alpha.7

* Added engines dependendy to package.json
* Added esdoc config, updated docs
* Removed DefaultServiceProvider
* Pass on a 'proc' object instead of metadata in applications
* Added helpers to application init call

## v3.0.0-alpha.6

* Provide error code in scandir fail
* Corrected URLs in package.json

## v3.0.0-alpha.5

Initial public release
