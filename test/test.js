(function(root, factory){
	if (typeof exports == 'object'){ //nodejs context
		/*
		* LOAD RAW BUILD
		*/
		var libsodium;
		var path = require('path');
		try {
			libsodium = require(path.join(__dirname, '../libsodium'));
		} catch (e){
		}
		if (!libsodium){
			console.log('Missing raw libsodium.js build. Downloading it');
			//npm install libsodium
			process.chdir(__dirname);
			var spawn = require('child_process').spawn;
			var npmInstall = spawn('npm', ['install', 'libsodium'], {cwd: process.cwd()});
			npmInstall.on('close', function(npmExitCode){
				if (npmExitCode == 0){ //Success
					console.log('NPM exited with success');
					doTests();
				} else {
					console.error('NPM exited with code ' + npmExitCode);
					process.exit(npmExitCode);
				}
			});
		} else doTests();

		function doTests(){
			console.log('Testing libsodium.js with vectors, through the wrappers');
			console.log('-------------------------------------------------------');
			factory(require(path.join(__dirname, '../dist/modules/libsodium-wrappers.js')), true);
		}
	} else { //Browser's context
		factory(window.sodium);
	}
})(this, function(sodium, nodeEnv){
	var sodium_test = (function(){

		//This script tests a good chunk of the algorithms available in libsodium. The tests here are done with vectors harvested from the original C-written library

		var t = {};
		var to_hex = sodium.to_hex;
		var from_hex = sodium.from_hex;
		var is_hex = function(s){
			return /^[a-fA-F0-9]+$/g.test(s) && s.length % 2 == 0;
		}

		t.scrypt = function(){
			if (typeof sodium.crypto_pwhash_scryptsalsa208sha256 != 'function')
				throw new Error('scrypt cannot be found in the js-built library');

			var vectors = [
				{
					pass: 'password',
					salt: 'NaCl',
					keyLength: 64,
					r: 8,
					p: 16,
					opsLimit: 1024,
					result: 'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640'
				},
				{
					pass: 'pleaseletmein',
					salt: 'SodiumChloride',
					keyLength: 64,
					r: 8,
					p: 1,
					opsLimit: 16384,
					result: '7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2d5432955613f0fcf62d49705242a9af9e61e85dc0d651e40dfcf017b45575887'
				}
			];

			vectors.forEach(testVector);

			function testVector(v){
				var derivedKey = sodium.crypto_pwhash_scryptsalsa208sha256_ll(v.pass, v.salt, v.opsLimit, v.r, v.p, v.keyLength);
				if (v.result != to_hex(derivedKey)){
					throw new Error('Error in pwhash_scryptsalsa208sha256_ll with vector ' + JSON.stringify(v));
				}
			}

		};

		t.scalarmult = function(){

			function scalarmult_base_test(){
				var secretKey = '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb';
				var publicKey = sodium.crypto_scalarmult_base(from_hex(secretKey));
				var expectedPubKey = 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f';
				if (to_hex(publicKey) != expectedPubKey) throw new Error('Error in scalarmult_base');
			}
			scalarmult_base_test();

			var scalarmult_vectors = [
				{
					secretKey: '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a',
					publicKey: 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f',
					sharedSecret: '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742'
				},
				{
					secretKey: '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb',
					publicKey: '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a',
					sharedSecret: '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742'
				}
			];

			function scalarmult_test(v){
				var sharedSecret = sodium.crypto_scalarmult(from_hex(v.secretKey), from_hex(v.publicKey));
				if (v.sharedSecret != to_hex(sharedSecret)) throw new Error('Error in scalarmult with vector ' + JSON.stringify(v));
			}
			scalarmult_vectors.forEach(scalarmult_test);

		};

		t.sign = function(callback){
			if (!nodeEnv && typeof callback != 'function') throw new TypeError('callback must be defined and must be a function');

			var vData;
			if (nodeEnv){
				vData = require('./ed-vectors.json');
				testVectors();
			} else {
				var loadVectorsReq = new XMLHttpRequest();
				loadVectorsReq.open('get', 'ed-vectors.json', true);
				loadVectorsReq.onload = function(e){
					vData = loadVectorsReq.responseText;
					try {
						vData = JSON.parse(vData);
					} catch (e){
						callback(new Error('cannot parse ed25519 vectors'));
						return;
					}
					if (!Array.isArray(vData)){
						callback(new Error('invalid ed25519 vectors list'));
						return;
					}
					testVectors();
				};
				loadVectorsReq.send();
			}

			function testVectors(){
				var currentVector;
				var nTests = 64;
				console.log('(Testing ' + nTests + ' different Ed25519 vectors)');
				var testCount = 0;
				try {
					while (testCount < nTests){
						currentVector = vData[Math.floor(Math.random() * vData.length)];
						testVector(currentVector);
						testCount++;
					}
				} catch (e){
					console.log('Error on test no. ' + testCount);
					if (callback) callback(e + ' ' + JSON.stringify(currentVector));
					else throw new Error(e + ' ' + JSON.stringify(currentVector));
					return;
				}
				if (callback) callback(undefined, {tested: nTests, count: vData.length});
				else return {tested: nTests, count: vData.length};

				function testVector(v){
					var publicKey = v.sk.substr(64); //sodium.crypto_sign_ed25519_sk_to_pk(v.sk);
					if (publicKey != v.pk) throw new Error('error with sk to pk derivation in Ed25519');
					var signature = sodium.crypto_sign_detached(from_hex(v.m), from_hex(v.sk));
					if (to_hex(signature) != v.s) throw new Error('unexpected signature in Ed25519');
					var isValid = sodium.crypto_sign_verify_detached(signature, from_hex(v.m), from_hex(publicKey));
					if (!isValid) throw new Error('invalid signature in Ed25519');
				}
			}

		};

		t.secretbox_easy = function(){
			var vectors = [
				{
					key: '1b27556473e985d462cd51197a9a46c76009549eac6474f206c4ee0844f68389',
					nonce: '69696ee955b62b73cd62bda875fc73d68219e0036b7a0b37',
					m: 'be075fc53c81f2d5cf141316ebeb0c7b5228c52a4c62cbd44b66849b64244ffce5ecbaaf33bd751a1ac728d45e6c61296cdc3c01233561f41db66cce314adb310e3be8250c46f06dceea3a7fa1348057e2f6556ad6b1318a024a838f21af1fde048977eb48f59ffd4924ca1c60902e52f0a089bc76897040e082f937763848645e0705',
					c: 'f3ffc7703f9400e52a7dfb4b3d3305d98e993b9f48681273c29650ba32fc76ce48332ea7164d96a4476fb8c531a1186ac0dfc17c98dce87b4da7f011ec48c97271d2c20f9b928fe2270d6fb863d51738b48eeee314a7cc8ab932164548e526ae90224368517acfeabd6bb3732bc0e9da99832b61ca01b6de56244a9e88d5f9b37973f622a43d14a6599b1f654cb45a74e355a5'
				}
			];

			for (var i = 0; i < vectors.length; i++){
				secretbox_test(vectors[i]);
			}

			function secretbox_test(v){
				var cipher = sodium.crypto_secretbox_easy(from_hex(v.m), from_hex(v.nonce), from_hex(v.key));
				if (to_hex(cipher) != v.c) throw new Error('Unexpected ciphertext');
				var plaintext = sodium.crypto_secretbox_open_easy(cipher, from_hex(v.nonce), from_hex(v.key));
				if (!(plaintext && to_hex(plaintext) == v.m)) throw new Error('Unexpected plaintext');
			}
		};

		t.hash = function(){
			var sha512Vectors = [
				{
					m: 'testing\n',
					h: '24f950aac7b9ea9b3cb728228a0c82b67c39e96b4b344798870d5daee93e3ae5931baae8c7cacfea4b629452c38026a81d138bc7aad1af3ef7bfd5ec646d6c28'
				},
				{
					m: 'The Conscience of a Hacker is a small essay written January 8, 1986 by a computer security hacker who went by the handle of The Mentor, who belonged to the 2nd generation of Legion of Doom.',
					h: 'a77abe1ccf8f5497e228fbc0acd73a521ededb21b89726684a6ebbc3baa32361aca5a244daa84f24bf19c68baf78e6907625a659b15479eb7bd426fc62aafa73'
				}
			];
			var sha256Vectors = [
				{
					m: 'testing\n',
					h: '12a61f4e173fb3a11c05d6471f74728f76231b4a5fcd9667cef3af87a3ae4dc2'
				},
				{
					m: 'The Conscience of a Hacker is a small essay written January 8, 1986 by a computer security hacker who went by the handle of The Mentor, who belonged to the 2nd generation of Legion of Doom.',
					h: '71cc8123fef8c236e451d3c3ddf1adae9aa6cd9521e7041769d737024900a03a'
				}
			];

			if (sodium.crypto_hash) for (var i = 0; i < sha512Vectors.length; i++) sha512_test(sha512Vectors[i]);
			if (sodium.crypto_hash_sha256) for (var i = 0; i < sha256Vectors.length; i++) sha256_test(sha256Vectors[i]);

			function sha512_test(v){
				var hash = sodium.crypto_hash(v.m);
				if (to_hex(hash) != v.h) throw new Error('Unexpected hash value for vector ' + JSON.stringify(v));
			}

			function sha256_test(v){
				var hash = sodium.crypto_hash_sha256(v.m);
				if (to_hex(hash) != v.h) throw new Error('Unexpected hash value for vector ' + JSON.stringify(v));
			}

		};

		t.hmac = function(){
			function testHmacVector(auth_func, verify_func, key_bytes, v) {
				var key, msg;

				if (is_hex(v.k)) {
					key = from_hex(v.k);
				} else if (v.k.length < key_bytes) {
					var newKeyBuffer = new Uint8Array(sodium.crypto_auth_KEYBYTES);
					var utf8KeyBuffer = sodium.from_string(v.k);
					for (var i = 0; i < v.k.length; i++) newKeyBuffer[i] = utf8KeyBuffer[i];
					key = newKeyBuffer;
				} else {
					key = v.k;
				}

				if (is_hex(v.m)) {
					msg = from_hex(v.m);
				} else {
					msg = v.m;
				}

				var tag = auth_func(msg, key);
				var tagHex = to_hex(tag);

				if (tagHex != v.h)
					throw new Error('Unexpected HMAC for vector: ' + JSON.stringify(v));

				if (!verify_func(tag, msg, key))
					throw new Error('Cannot verify HMAC for vector: ' + JSON.stringify(v));
			}

			var hmacSHA512256Vectors = [
				{
					k: 'Jefe',
					m: 'what do ya want for nothing?',
					h: '164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea250554'
				}
			];

			var hmacSHA512Vectors = [
				{
					k: 'Jefe',
					m: 'what do ya want for nothing?',
					h: '164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737'
				}
			];
			var hmacSHA256Vectors = [
				{
					k: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
					m: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
					h: '372efcf9b40b35c2115b1346903d2ef42fced46f0846e7257bb156d3d7b30d3f'
				}
			];

			for (var i = 0; i < hmacSHA512256Vectors.length; i++)
				testHmacVector(sodium.crypto_auth, sodium.crypto_auth_verify,
						sodium.crypto_auth_KEYBYTES, hmacSHA512256Vectors[i]);

			for (var i = 0; i < hmacSHA512Vectors.length; i++)
				testHmacVector(sodium.crypto_auth_hmacsha512, sodium.crypto_auth_hmacsha512_verify,
						sodium.crypto_auth_hmacsha512_KEYBYTES, hmacSHA512Vectors[i]);

			for (var i = 0; i < hmacSHA256Vectors.length; i++)
				testHmacVector(sodium.crypto_auth_hmacsha256, sodium.crypto_auth_hmacsha256_verify,
						sodium.crypto_auth_hmacsha256_KEYBYTES, hmacSHA256Vectors[i]);
		};

		t.chacha20 = function () {
			var vectors = [
				{
					k: '0000000000000000000000000000000000000000000000000000000000000000',
					n: '0000000000000000',
					i: 0,
					m: '76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7da41597c5157488d7724e03fb8d84a376a43b8f41518a11cc387b669',
				},
				{
					k: '0000000000000000000000000000000000000000000000000000000000000000',
					n: '0000000000000000',
					i: 65535,
					m: 'f2b29895eb58df566f199a5b40d4c9402e63da47fc99a9a9e7926193a20366b66e40821de33e4ce0bd9d7f36e016daacf7e613be123b6b708fc3921c',
				},
				{
					k: '0000000000000000000000000000000000000000000000000000000000000001',
					n: '0000000000000000',
					i: 0,
					m: '4540f05a9f1fb296d7736e7b208e3c96eb4fe1834688d2604f450952ed432d41bbe2a0b6ea7566d2a5d1e7e20d42af2c53d792b1c43fea817e9ad275',
				},
				{
					k: '0000000000000000000000000000000000000000000000000000000000000000',
					n: '0000000000000001',
					i: 0,
					m: 'de9cba7bf3d69ef5e786dc63973f653a0b49e015adbff7134fcb7df137821031e85a050278a7084527214f73efc7fa5b5277062eb7a0433e445f41e3',
				},
				{
					k: '0000000000000000000000000000000000000000000000000000000000000000',
					n: '0100000000000000',
					i: 0,
					m: 'ef3fdfd6c61578fbf5cf35bd3dd33b8009631634d21e42ac33960bd138e50d32111e4caf237ee53ca8ad6426194a88545ddc497a0b466e7d6bbdb004',
				},
				{
					k: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
					n: '0001020304050607',
					i: 0,

					/* IETF test vector differs because IETF chacha20 has a 96-bit nonce and a
					   32-bit counter, while the original implementation uses 64 bits for both. */
					m: 'f798a189f195e66982105ffb640bb7757f579da31602fc93ec01ac56f85ac3c134a4547b733b46413042c9440049176905d3be59ea1c53f15916155c2be8241a38008b9a26bc35941e2444177c8ade6689de95264986d95889fb60e84629c9bd9a5acb1cc118be563eb9b3a4a472f82e09a7e778492b562ef7130e88dfe031c79db9d4f7c7a899151b9a475032b63fc385245fe054e3dd5a97a5f576fe064025d3ce042c566ab2c507b138db853e3d6959660996546cc9c4a6eafdc777c040d70eaf46f76dad3979e5c5360c3317166a1c894c94a371876a94df7628fe4e',
				},
			];

			function testVector(v) {
				var key = from_hex(v.k);
				var nonce = from_hex(v.n);
				var msg = new Uint8Array(v.m.length >> 1);

				var res = sodium.crypto_stream_chacha20_xor_ic(msg, nonce, v.i, key, "hex");

				if (res != v.m)
					throw new Error('Expected `' + v.m + '`, got `' + res + '`.');
			}

			for (var i = 0; i < vectors.length; i++)
				testVector(vectors[i]);
		}

		return t;
	})();

	if (nodeEnv){
		var tests = [
			['Testing scrypt', sodium_test.scrypt],
			['Testing HMAC', sodium_test.hmac],
			['Testing hashing', sodium_test.hash],
			['Testing Curve25519', sodium_test.scalarmult],
			['Testing Ed25519', sodium_test.sign],
			['Testing Secretbox_Easy', sodium_test.secretbox_easy]
		];
		for (var i = 0; i < tests.length; i++){
			try {
				console.log(tests[i][0]);
				tests[i][1]();
			} catch (e){
				console.error('Error while ' + tests[i][0]);
				console.error(e);
				process.exit(1);
			}
		}
	} else {
		window.sodium_test = sodium_test;
	}

});
